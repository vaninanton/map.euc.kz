#!/usr/bin/env node
// Полная пересборка src/data/almaty.json из OpenStreetMap (Overpass API).
//
// Почему OSM: velojol.kz, прежний источник, с 2026-09 недоступен (домен .kz
// в статусе serverHold у регистратора). См. .claude/skills/update-bike-paths/SKILL.md.
//
// Конвейер (buildSegments): классификация way → названия → чистка дублей и
// хвостиков → склейка по общим точкам → кольца разворота → срез загибов →
// склейка через разрывы → чистка объездов. Склейка осторожная: только без
// развилки или через короткий прямой разрыв — склейка по одной близости
// концов перескакивала на другую сторону улицы, и дорожки накладывались.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'almaty.json')

/** Алматы с пригородами: юг, запад, север, восток. */
const BBOX = '43.14,76.80,43.36,77.10'
/**
 * Основной сервер — несколько попыток с паузой: на перегрузке он отвечает
 * 504, а через полминуты отдаёт данные. Зеркало — последний шанс: 2026-09
 * оно вернуло 842 объекта вместо 2600 (почти без улиц для названий).
 */
const OVERPASS_ATTEMPTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]
const OVERPASS_RETRY_PAUSE_MS = 30_000

/** Классы дорог, чьи названия годятся безымянной велодорожке, идущей вдоль. */
const NAMING_ROAD_CLASSES = 'trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian'

/** Радиус поиска улицы для безымянной дорожки: тротуар + газон + половина проезжей части. */
const NAME_SEARCH_METERS = 35

/** Доля длины дорожки, которая должна идти вдоль одной улицы, чтобы взять её название. */
const NAME_MIN_SHARE = 0.6

/** Шаг, с которым дорожку опрашивают на ближайшую улицу. */
const NAME_SAMPLE_METERS = 10

/** Точность координат: 6 знаков ≈ 0.1 м. */
const COORD_PRECISION = 6

/** Защита от полупустого ответа Overpass: меньше этого файл не перезаписываем. */
const MIN_SEGMENTS_TO_WRITE = 50

/**
 * Защита от неполного ответа: если без названия осталось больше этой доли
 * кусков, в ответе не хватает улиц — файл не перезаписываем. В полном ответе
 * доля ~14 %, в обрезанном ответе зеркала было 45 %.
 */
const MAX_FALLBACK_SHARE = 0.25

/**
 * Склейка через разрыв: максимальный разрыв между концами — ширина большого
 * перекрёстка. Велодорожка в OSM часто обрывается у перекрёстка, дальше идут
 * только пешеходные переходы (улица Жандосова: разрывы 24 и 37 м). На
 * дорожку по другой стороне улицы порог не пускает — это разворот, его
 * отсекает проверка угла при любом расстоянии.
 */
const BRIDGE_MAX_GAP_METERS = 40

/** Склейка через разрыв: максимальный излом линии в месте стыка. */
const BRIDGE_MAX_TURN_DEGREES = 35

/** Короче — направление перемычки не проверяем (см. mergeAcrossGaps). */
const BRIDGE_NO_SIDE_CHECK_METERS = 10

/**
 * Длинный разрыв (до BRIDGE_STRAIGHT_MAX_GAP_METERS) клеим, только если
 * дорожка идёт строго по прямой: излом и отклонение перемычки до
 * BRIDGE_STRAIGHT_MAX_TURN_DEGREES. Так через широкий перекрёсток
 * склеивается улица Тимирязева (разрыв 84 м, излом 1°).
 */
const BRIDGE_STRAIGHT_MAX_GAP_METERS = 100
const BRIDGE_STRAIGHT_MAX_TURN_DEGREES = 15

/**
 * На длинном разрыве мал даже малый угол: 9° на 85 м — это 13 м вбок, то
 * есть уже дорожка по другой стороне улицы (улица Жумабаева: линия
 * перескакивала на встречную сторону). Поэтому там ограничен и сдвиг вбок.
 * Не меньше 8 м: переход с полосы по оси дороги на дорожку по тротуару даёт
 * такой сдвиг законно (улица Манаса у Сатпаева).
 */
const BRIDGE_STRAIGHT_MAX_SIDESTEP_METERS = 10

/**
 * Висячий хвостик: way короче этого, который одним концом растёт из
 * развилки велодорожек, а другим никуда не ведёт. На перекрёстке Манаса и
 * Абая 9-метровый хвостик полосы (1355938166) создавал ложную развилку, и
 * улица не склеивалась.
 */
const SPUR_MAX_METERS = 20

/**
 * Итоговая линия короче этого — огрызок у перекрёстка, а не велодорожка
 * (улица Байсеитовой, 1234909735: 5 м дороги с `cycleway=shoulder`).
 */
const MIN_LINE_METERS = 20

/**
 * Загнутый кончик: последние до HOOK_MAX_METERS линии поворачивают на
 * HOOK_MIN_TURN_DEGREES и больше, а сам кончик ни с чем не соединён — обычно
 * это заворот к переходу. Перед склейкой через разрыв его срезаем: иначе
 * направление конца смотрит вбок и продолжение не находится (Утепова:
 * 1415138779 кончается загибом на 24 м под прямым углом).
 */
const HOOK_MAX_METERS = 30
const HOOK_MIN_TURN_DEGREES = 60

/** Кольцо разворота длиной до этого пристёгиваем к линии, упёршейся в него. */
const RING_MAX_METERS = 600

/**
 * Кандидат на склейку через разрыв должен быть явно ближайшим: следующий
 * по удалённости — дальше хотя бы на столько. Иначе (две дорожки рядом на
 * одинаковом расстоянии) не клеим ни с одной.
 */
const BRIDGE_CLEAR_WINNER_METERS = 10

/**
 * Кандидатов сравниваем по «расстояние + вес × сдвиг вбок»: у перекрёстка
 * улицы с дорожками по обеим сторонам конец встречной стороны бывает почти
 * так же близко (Гоголя: 29 м против 23 м), но сдвинут вбок на ширину улицы.
 */
const BRIDGE_SIDESTEP_WEIGHT = 3

/**
 * Направление конца линии меряем по последним стольким метрам. Не короче:
 * у перекрёстка велодорожка загибается к переезду, и по последним 20 м
 * излом выходит 36–40° там, где дорожка идёт прямо (улица Тимирязева).
 */
const END_HEADING_METERS = 50

/**
 * Полоса на дороге, идущая вдоль отдельно нарисованной велодорожки, —
 * дубль: коридор и доля длины в нём. Коридор — полоса + тротуар; дальше
 * начинается дорожка по другой стороне улицы.
 */
const DUPLICATE_LANE_METERS = 15
const DUPLICATE_LANE_MIN_SHARE = 0.8

/**
 * Короче — не проверяем на дубль: кусок дороги на перекрёстке всегда лежит
 * рядом с поперечной велодорожкой, и без этого порога полосы на Кунаева,
 * Сейфуллина и других рвались бы на каждом перекрёстке.
 */
const DUPLICATE_LANE_MIN_METERS = 50

/**
 * Дубль в данных OSM: way, чья длина почти целиком (DUPLICATE_WAY_MIN_SHARE)
 * лежит в DUPLICATE_WAY_METERS от другого way. Так нарисован мост через БАК
 * (1087917591 и 1087917592 — в 0.2 м друг от друга).
 */
const DUPLICATE_WAY_METERS = 2
const DUPLICATE_WAY_MIN_SHARE = 0.9

/**
 * Объезд — короткая линия (до BYPASS_MAX_METERS), оба конца которой лежат
 * на другой линии (ближе BYPASS_ATTACH_METERS), а сама она не отходит от неё
 * дальше BYPASS_MAX_OFFSET_METERS. Полоса на Макатаева огибает остановки
 * такими петлями по 30–40 м: участок и так показан основной линией, а петля
 * растёт «из середины» и оставалась бы огрызком.
 */
const BYPASS_MAX_METERS = 100
const BYPASS_ATTACH_METERS = 1.5
const BYPASS_MAX_OFFSET_METERS = 15

/** Надёжность названия куска: из тегов OSM, подобрано по улице рядом, нет. */
const NAME_RANK = { osm: 2, inferred: 1, none: 0 }

/**
 * Кусок с подобранным названием уступает соседу, только если он короче: на
 * углу улиц соседом оказывается другая улица, и длинный кусок Саина или
 * Тимирязева иначе уходил в «вдоль БАКа» или «Жарокова».
 */
const ADOPT_MAX_INFERRED_METERS = 150

/**
 * Склеенная линия с подобранным названием берёт название соседней линии,
 * если дорожка идёт дальше прямо: излом до BRIDGE_MAX_TURN_DEGREES, измеренный
 * на таком расстоянии от стыка. Ближе мерить нельзя — на углу дорожка плавно
 * огибает перекрёсток, и по 50 м угол Утепова/Кекилбайулы выглядел прямым
 * (0°), а на 250 м он 57°. Прямая Абая → Нурпеисова — 1°: ближайшая улица
 * сменилась, а дорожка та же.
 */
const STRAIGHT_NAME_HEADING_METERS = 250

/**
 * Велодорожки, которые не показываем, хотя в OSM они размечены (решения
 * владельца). id — id way в OSM. Чтобы вернуть дорожку, уберите id; если
 * id пропал из OSM, сводка предупредит — тогда уберите его и отсюда.
 */
export const HIDDEN_WAY_IDS = new Set([
    238779261, // Парк Первого Президента: кататься на велосипеде запрещено (2026-09-25)
    1211718036, // Отросток на запад от петли с въездом (MERGE_GROUPS), не дорожка (2026-09-25)
])

/**
 * Ручные склейки для мест, где общие правила бессильны: развилки, которые на
 * самом деле одна дорожка (решения владельца). id — way OSM в порядке
 * прохождения дорожки; каждый кусок разворачивается к хвосту цепочки
 * ближайшим концом. Склейка идёт до всех проходов, дальше группа — один
 * кусок. Пропавший из OSM id или разрыв больше MERGE_GROUP_MAX_GAP_METERS —
 * предупреждение в сводке.
 */
export const MERGE_GROUPS = [
    // Петля с въездом (2026-09-25): въезд → западная ветка → южная перемычка →
    // (разрыв 37 м) → восточная ветка обратно к въезду. Отросток 1211718036
    // на запад скрыт (HIDDEN_WAY_IDS).
    [1550614802, 1156582187, 1550614801, 1156582185],
]

/** Разрыв между кусками ручной склейки больше этого — похоже на ошибку в группе. */
const MERGE_GROUP_MAX_GAP_METERS = 60

/** Название дорожки без улицы рядом. */
const FALLBACK_NAME = 'Велодорожка'

/** Ключ склейки безымянной дорожки. */
const FALLBACK_KEY = FALLBACK_NAME.toLowerCase()

/** Разнобой написания одной улицы в OSM → единое название. Пополнять по сводке. */
const NAME_ALIASES = {
    'улица Каныша Сатпаева': 'улица Сатпаева',
}

const OVERPASS_QUERY = `
[out:json][timeout:120];
(
  way["highway"="cycleway"](${BBOX});
  way["highway"]["cycleway"](${BBOX});
  way["highway"]["cycleway:both"](${BBOX});
  way["highway"]["cycleway:left"](${BBOX});
  way["highway"]["cycleway:right"](${BBOX});
)->.bike;
.bike out geom;
way(around.bike:${String(NAME_SEARCH_METERS)})["highway"~"^(${NAMING_ROAD_CLASSES})$"]["name"];
out geom;
`

const LANE_TYPES = {
    separated: 'Обособленная велодорожка',
    shared: 'Вело-пешеходная дорожка',
    lane: 'Полоса',
}

/**
 * Значения cycleway-тегов на дороге: какая это инфраструктура. `null` —
 * велодорожки на этой дороге нет или её рисовать не надо: `separate`
 * (дорожка нарисована отдельной линией — иначе будет дубль вдоль оси
 * дороги), `crossing` (переезд через дорогу), `shared_lane` / `share_busway`
 * (общая полоса с машинами или автобусами — не велоинфраструктура).
 */
const ROAD_CYCLEWAY_VALUES = {
    track: 'separated',
    opposite_track: 'separated',
    lane: 'lane',
    opposite_lane: 'lane',
    shoulder: 'lane',
}

const ROAD_CYCLEWAY_KEYS = ['cycleway', 'cycleway:both', 'cycleway:left', 'cycleway:right']

/**
 * Определяет, велодорожка ли этот way OSM и какого типа. Возвращает
 * `{ laneType, description? }` или `null`, если way рисовать не нужно.
 * Строящиеся участки (`highway=construction` + `construction=cycleway`) не
 * берём намеренно — решение владельца (2026-09-25): на карте только то, по
 * чему уже можно ехать. Построенный участок появится, когда в OSM ему
 * поменяют тег на `highway=cycleway`.
 */
export function classifyWay(tags) {
    // Трассы кросс-кантри (XCO Alatau) размечены как cycleway, но это
    // спорт в горах, а не городская велодорожка.
    if (/\bXCO\b/i.test(tags.name ?? '')) return null
    if (tags.highway === 'cycleway') {
        // Переезды через дорогу — отдельные короткие way поперёк проезжей
        // части; на карте они выглядят как огрызки поперёк улиц.
        if (tags.cycleway === 'crossing' || tags.footway === 'crossing') return null
        const pedestrians = tags.foot === 'designated' || tags.foot === 'yes'
        return { laneType: pedestrians && tags.segregated !== 'yes' ? 'shared' : 'separated' }
    }
    const sides = new Map()
    for (const key of ROAD_CYCLEWAY_KEYS) {
        const laneType = ROAD_CYCLEWAY_VALUES[tags[key]]
        if (laneType === undefined) continue
        const side = key.split(':')[1] ?? 'both'
        sides.set(side, laneType)
    }
    if (sides.size === 0) return null
    // Обособленная сторона важнее полосы: тип показываем по лучшей стороне.
    const laneType = [...sides.values()].includes('separated') ? 'separated' : 'lane'
    const both = sides.has('both') || (sides.has('left') && sides.has('right'))
    return both ? { laneType, description: 'С обеих сторон дороги' } : { laneType }
}

/** Название из тегов OSM: русское, если есть, с поправкой по NAME_ALIASES. */
export function osmName(tags) {
    const raw = (tags['name:ru'] ?? tags.name ?? '').replace(/\s+/g, ' ').trim()
    return NAME_ALIASES[raw] ?? raw
}

// Локальная равнопромежуточная проекция в метры — на масштабе города
// погрешность доли процента, а считать расстояния до отрезков так проще.
const LAT0 = 43.25
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const KY = 110540
const project = ([lon, lat]) => [lon * KX, lat * KY]

/** Расстояние между точками проекции, м. */
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** Единичный вектор (нулевой остаётся нулевым). */
function unit([x, y]) {
    const length = Math.hypot(x, y) || 1
    return [x / length, y / length]
}

function angleDegrees([ax, ay], [bx, by]) {
    return (Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by))) * 180) / Math.PI
}

/** Ключ точки для склейки: координаты уже округлены до 6 знаков. */
function pointKey([lon, lat]) {
    return `${String(lon)},${String(lat)}`
}

/** Точка → в скольких линиях она встречается (повтор внутри одной линии — один раз). */
function countPointUses(lines) {
    const uses = new Map()
    for (const line of lines) {
        for (const key of new Set(line.coordinates.map(pointKey))) uses.set(key, (uses.get(key) ?? 0) + 1)
    }
    return uses
}

/** Добавляет value в список map[key], создавая список при первом обращении. */
function pushTo(map, key, value) {
    const list = map.get(key)
    if (list === undefined) map.set(key, [value])
    else list.push(value)
}

function segmentDistance(p, a, b) {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq))
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

/** Длина линии в метрах (формула гаверсинуса). */
export function lengthMeters(coords) {
    const R = 6371000
    const toRad = (deg) => (deg * Math.PI) / 180
    let total = 0
    for (let i = 1; i < coords.length; i++) {
        const [lon1, lat1] = coords[i - 1]
        const [lon2, lat2] = coords[i]
        const a =
            Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2
        total += 2 * R * Math.asin(Math.sqrt(a))
    }
    return total
}

/**
 * Клетка сетки пространственного индекса. Поиск смотрит клетку точки и 8
 * соседних, поэтому радиус любого поиска не должен превышать размер клетки.
 */
const INDEX_CELL_METERS = NAME_SEARCH_METERS

const cellKey = (cx, cy) => `${String(cx)}:${String(cy)}`

/**
 * Пространственный индекс линий: отрезки разложены по клеткам сетки, чтобы
 * не перебирать весь город для каждой точки. lines: [{ name, coordinates }];
 * name — метка линии, которую возвращает поиск.
 */
export function buildRoadIndex(lines) {
    const cells = new Map()
    for (const line of lines) {
        const points = line.coordinates.map(project)
        for (let i = 1; i < points.length; i++) {
            const [a, b] = [points[i - 1], points[i]]
            const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])]
            const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])]
            for (let cx = Math.floor(x0 / INDEX_CELL_METERS); cx <= Math.floor(x1 / INDEX_CELL_METERS); cx++) {
                for (let cy = Math.floor(y0 / INDEX_CELL_METERS); cy <= Math.floor(y1 / INDEX_CELL_METERS); cy++) {
                    pushTo(cells, cellKey(cx, cy), { a, b, name: line.name })
                }
            }
        }
    }
    return cells
}

/** Отрезки индекса в радиусе maxMeters от точки: [{ distance, name }]. */
function* segmentsNear(point, index, maxMeters) {
    const cx = Math.floor(point[0] / INDEX_CELL_METERS)
    const cy = Math.floor(point[1] / INDEX_CELL_METERS)
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (const seg of index.get(cellKey(cx + dx, cy + dy)) ?? []) {
                const distance = segmentDistance(point, seg.a, seg.b)
                if (distance <= maxMeters) yield { distance, name: seg.name }
            }
        }
    }
}

function nearestRoadName(point, index, maxMeters) {
    let best = null
    for (const hit of segmentsNear(point, index, maxMeters)) {
        if (best === null || hit.distance < best.distance) best = hit
    }
    return best?.name ?? null
}

/** Имена всех линий индекса в радиусе maxMeters от точки. */
function nearbyNames(point, index, maxMeters) {
    return new Set(Array.from(segmentsNear(point, index, maxMeters), (hit) => hit.name))
}

/**
 * Название для безымянной дорожки: улица, вдоль которой идёт большая часть
 * её длины (не меньше NAME_MIN_SHARE). Поперечные улицы, которые дорожка
 * пересекает, набирают лишь несколько точек у перекрёстка и не выигрывают.
 */
export function inferName(coords, index) {
    const samples = samplePoints(coords)
    const votes = new Map()
    for (const point of samples) {
        const name = nearestRoadName(point, index, NAME_SEARCH_METERS)
        if (name !== null) votes.set(name, (votes.get(name) ?? 0) + 1)
    }
    const top = maxBy(votes, (count) => count)
    return top !== undefined && votes.get(top) / samples.length >= NAME_MIN_SHARE ? top : null
}

/**
 * Ключ Map с наибольшим score(value); при равенстве — первый добавленный.
 * undefined для пустой Map.
 */
function maxBy(map, score) {
    let bestKey
    let bestScore = -Infinity
    for (const [key, value] of map) {
        if (score(value) > bestScore) [bestKey, bestScore] = [key, score(value)]
    }
    return bestKey
}

/** Точки вдоль линии с шагом ~NAME_SAMPLE_METERS, в метрах локальной проекции. */
function samplePoints(coords) {
    const points = coords.map(project)
    const samples = []
    for (let i = 1; i < points.length; i++) {
        const [a, b] = [points[i - 1], points[i]]
        const steps = Math.max(1, Math.round(dist(a, b) / NAME_SAMPLE_METERS))
        for (let k = 0; k < steps; k++) {
            const t = (k + 0.5) / steps
            samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        }
    }
    return samples
}

/**
 * Полоса на дороге — дубль отдельно нарисованной велодорожки: доля её длины
 * в коридоре DUPLICATE_LANE_METERS от линий индекса не меньше
 * DUPLICATE_LANE_MIN_SHARE. Так бывает, когда велодорожку нарисовали
 * отдельно, а на дороге забыли сменить `cycleway=lane` на `separate`
 * (улица Богенбай Батыра, way 912358838 — в 6 м от отдельной дорожки).
 */
export function isDuplicateLane(coords, cyclewayIndex) {
    if (lengthMeters(coords) < DUPLICATE_LANE_MIN_METERS) return false
    const samples = samplePoints(coords)
    const near = samples.filter((point) => nearestRoadName(point, cyclewayIndex, DUPLICATE_LANE_METERS) !== null)
    return near.length / samples.length >= DUPLICATE_LANE_MIN_SHARE
}

function roundCoord(value) {
    const factor = 10 ** COORD_PRECISION
    return Math.round(value * factor) / factor
}

/** Разворачивает линию: концы меняются местами вместе с узлами. */
function reversed(line) {
    return {
        ...line,
        coordinates: [...line.coordinates].reverse(),
        startNode: line.endNode,
        endNode: line.startNode,
    }
}

/**
 * Приставляет `next` к концу `line`. Оба уже развёрнуты так, что стык —
 * конец `line` и начало `next`; совпадающую точку стыка не дублируем.
 */
function append(line, next) {
    const tail = line.coordinates[line.coordinates.length - 1]
    const [head, ...rest] = next.coordinates
    const samePoint = tail[0] === head[0] && tail[1] === head[1]
    return {
        ids: [...line.ids, ...next.ids],
        parts: [...line.parts, ...next.parts],
        // Безымянная часть не задаёт ключ: склейка продолжается по названию.
        key: line.key === FALLBACK_KEY ? next.key : line.key,
        coordinates: line.coordinates.concat(samePoint ? rest : next.coordinates),
        startNode: line.startNode,
        endNode: next.endNode,
    }
}

/**
 * Проход 1 — склейка по топологии OSM. Дорогу в OSM режут на каждом
 * перекрёстке и при смене любого автомобильного тега (полосность, скорость),
 * поэтому велополоса на ней приходит десятками кусков: улица Сатпаева — 45.
 * Два куска сливаются, если кончаются в одном узле OSM, у них одинаковый key
 * (название) и через этот узел не проходит больше ни одна велодорожка.
 * Развилку считаем по всем велодорожкам, а не только по кускам с тем же
 * key: иначе из трёх дорожек в узле две одноимённые склеятся через
 * развилку, и линия развернётся назад (ловили на проспекте Райымбека).
 * lines: [{ ids, key, coordinates, startNode, endNode }];
 * nodeUses: узел → сколько раз он встречается во всех велодорожках.
 */
export function mergeByNodes(lines, nodeUses) {
    const byKey = new Map()
    for (const line of lines) pushTo(byKey, line.key, line)
    const result = []
    for (const group of byKey.values()) {
        const ends = new Map()
        for (const line of group) {
            // Кольцо ни с кем не сливаем — свободных концов у него нет.
            if (line.startNode === line.endNode) continue
            for (const node of [line.startNode, line.endNode]) pushTo(ends, node, line)
        }
        const used = new Set()
        const nextThrough = (node) => {
            const list = ends.get(node) ?? []
            if (list.length !== 2 || nodeUses.get(node) !== 2) return undefined
            return list.find((line) => !used.has(line))
        }
        for (const start of group) {
            if (used.has(start)) continue
            used.add(start)
            let merged = start
            // Сначала тянем вперёд от конца, потом — развернув — от начала.
            for (let pass = 0; pass < 2; pass++) {
                for (let next = nextThrough(merged.endNode); next !== undefined; next = nextThrough(merged.endNode)) {
                    used.add(next)
                    merged = append(merged, next.startNode === merged.endNode ? next : reversed(next))
                }
                merged = reversed(merged)
            }
            result.push(merged)
        }
    }
    return result
}

/** Направление «наружу» из конца линии: единичный вектор в метрах. */
function outwardHeading(line, atEnd, meters = END_HEADING_METERS) {
    const points = (atEnd ? [...line.coordinates].reverse() : line.coordinates).map(project)
    const tip = points[0]
    let far = points[1]
    for (const point of points.slice(1)) {
        far = point
        if (dist(tip, point) >= meters) break
    }
    return unit([tip[0] - far[0], tip[1] - far[1]])
}

/**
 * Проход 2 — склейка через короткий разрыв. У перекрёстков отдельная
 * велодорожка часто рвётся на 10–15 м: переезд через дорогу — отдельный way,
 * а его на карту не берём. Два конца сливаются, только если одновременно:
 * одинаковый key (безымянные — тоже: кольцо в парке 223199476 разорвано на
 * 8 м; от сборки по городу в километровые линии защищают проверки ниже), разрыв до
 * BRIDGE_MAX_GAP_METERS, линия продолжается почти прямо (излом и отклонение
 * перемычки до BRIDGE_MAX_TURN_DEGREES; на разрыве до
 * BRIDGE_STRAIGHT_MAX_GAP_METERS — строго прямо и почти без сдвига вбок), и
 * концы — явно лучшие друг для друга (BRIDGE_CLEAR_WINNER_METERS по оценке
 * «расстояние + BRIDGE_SIDESTEP_WEIGHT × сдвиг вбок»). Поперечная дорожка,
 * растущая «из середины» (примыкание под прямым углом), не клеится ни при
 * каком разрыве; разворот на дорожку по другой стороне улицы не проходит ни
 * по углу, ни по расстоянию.
 */
export function mergeAcrossGaps(lines) {
    let current = [...lines]
    for (;;) {
        const ends = []
        for (const line of current) {
            for (const atEnd of [false, true]) {
                const coord = atEnd ? line.coordinates[line.coordinates.length - 1] : line.coordinates[0]
                ends.push({ line, atEnd, point: project(coord), heading: outwardHeading(line, atEnd) })
            }
        }
        // Перемычка от конца a к концу b: вектор, длина и сдвиг вбок от направления a.
        const bridge = (a, b) => {
            const gap = [b.point[0] - a.point[0], b.point[1] - a.point[1]]
            const sidestep = Math.abs(gap[0] * a.heading[1] - gap[1] * a.heading[0])
            return { gap, length: Math.hypot(gap[0], gap[1]), sidestep }
        }
        const fits = (a, b) => {
            if (a.line === b.line) return false
            // Одно название — или одна из линий безымянная: тогда она продолжает
            // соседнюю (Рыскулова: безымянный 1123077002 в 6 м от 467823821).
            if (a.line.key !== b.line.key && a.line.key !== FALLBACK_KEY && b.line.key !== FALLBACK_KEY) return false
            const { gap, length, sidestep } = bridge(a, b)
            if (length > BRIDGE_STRAIGHT_MAX_GAP_METERS) return false
            const long = length > BRIDGE_MAX_GAP_METERS
            const limit = long ? BRIDGE_STRAIGHT_MAX_TURN_DEGREES : BRIDGE_MAX_TURN_DEGREES
            // Линии смотрят друг на друга: направление A ≈ обратное направлению B.
            if (angleDegrees(a.heading, [-b.heading[0], -b.heading[1]]) > limit) return false
            // Перемычка идёт вдоль линии, а не вбок. На коротком разрыве не мерим:
            // концы кольца в парке (223199476) расходятся бок о бок на 8 м, и
            // перемычка смотрит вбок на 72°; другая сторона улицы — от 15 м.
            if (length < BRIDGE_NO_SIDE_CHECK_METERS) return true
            if (long && sidestep > BRIDGE_STRAIGHT_MAX_SIDESTEP_METERS) return false
            return angleDegrees(a.heading, [gap[0] / length, gap[1] / length]) <= limit
        }
        const score = (a, b) => {
            const { length, sidestep } = bridge(a, b)
            return length + BRIDGE_SIDESTEP_WEIGHT * sidestep
        }
        // Явно лучший подходящий конец: второй кандидат — заметно хуже.
        const best = (a) => {
            const list = ends.filter((b) => fits(a, b)).sort((x, y) => score(a, x) - score(a, y))
            if (list.length === 0) return undefined
            if (list.length > 1 && score(a, list[1]) - score(a, list[0]) < BRIDGE_CLEAR_WINNER_METERS) return undefined
            return list[0]
        }
        let pair
        for (const a of ends) {
            const b = best(a)
            if (b !== undefined && best(b) === a) {
                pair = [a, b]
                break
            }
        }
        if (pair === undefined) return current
        const [a, b] = pair
        const left = a.atEnd ? a.line : reversed(a.line)
        const right = b.atEnd ? reversed(b.line) : b.line
        current = current.filter((line) => line !== a.line && line !== b.line).concat([append(left, right)])
    }
}

/**
 * Убирает висячие хвостики (см. SPUR_MAX_METERS), пока они находятся:
 * после удаления одного хвостиком может стать соседний. Короткие перемычки
 * (оба конца связаны) и отдельно стоящие короткие куски не трогаем.
 * ways: [{ coordinates }].
 */
export function pruneSpurs(ways) {
    let current = ways
    for (;;) {
        const uses = countPointUses(current)
        const usesAt = (coord) => uses.get(pointKey(coord)) ?? 0
        const next = current.filter((way) => {
            if (lengthMeters(way.coordinates) >= SPUR_MAX_METERS) return true
            const ends = [usesAt(way.coordinates[0]), usesAt(way.coordinates[way.coordinates.length - 1])]
            // Хвостик растёт из развилки (там сходятся 3+ way) и никуда не ведёт.
            // Короткий последний кусок линии у разрыва (стык ровно с одним
            // соседом) — не хвостик: без него разрыв растёт и склейка рвётся
            // (Тимирязева: 37 м превращались в 49 м).
            const spur = (ends[0] >= 3 && ends[1] === 1) || (ends[1] >= 3 && ends[0] === 1)
            return !spur
        })
        if (next.length === current.length) return current
        current = next
    }
}

/**
 * Убирает way-дубли: почти целиком лежащие поверх другого way. Из пары
 * остаётся тот, чьи концы связаны с большим числом соседей (он держит
 * склейку), при равенстве — меньший id. ways: [{ id, coordinates }].
 */
export function dropDuplicateWays(ways) {
    const ownerOf = new Map(ways.map((way) => [way.id, way]))
    const index = buildRoadIndex(ways.map((way) => ({ name: way.id, coordinates: way.coordinates })))
    const ends = (way) => [way.coordinates[0], way.coordinates[way.coordinates.length - 1]].map(pointKey)
    const endUses = new Map()
    for (const way of ways) for (const key of ends(way)) endUses.set(key, (endUses.get(key) ?? 0) + 1)
    const links = (way) => ends(way).reduce((sum, key) => sum + (endUses.get(key) ?? 0), 0)
    const dropped = new Set()
    for (const way of ways) {
        const samples = samplePoints(way.coordinates)
        const covered = new Map()
        for (const point of samples) {
            for (const id of nearbyNames(point, index, DUPLICATE_WAY_METERS)) {
                if (id !== way.id) covered.set(id, (covered.get(id) ?? 0) + 1)
            }
        }
        const [meters, wayLinks] = [lengthMeters(way.coordinates), links(way)]
        for (const [id, count] of covered) {
            if (dropped.has(id) || count / samples.length < DUPLICATE_WAY_MIN_SHARE) continue
            const other = ownerOf.get(id)
            // Короткий кусок на длинной линии — дубль; из двух равных
            // убираем хуже связанный.
            const shorter = meters < lengthMeters(other.coordinates) - DUPLICATE_WAY_METERS
            const otherLinks = links(other)
            const weaker = wayLinks < otherLinks || (wayLinks === otherLinks && way.id > other.id)
            if (shorter || weaker) {
                dropped.add(way.id)
                break
            }
        }
    }
    return ways.filter((way) => !dropped.has(way.id))
}

/**
 * Кусок с менее надёжным названием берёт название соседа, если стыкуется с
 * ним концами в узле без развилки: безымянный продолжает улицу Саина
 * (1178012127 → 489253620), а мост через БАК, которому подобралось
 * «улица БАК», входит в «Улицу вдоль БАКа». Надёжность — NAME_RANK, при
 * равной уступает более короткий кусок. Название OSM не уступает никогда,
 * подобранное — только у короткого куска (ADOPT_MAX_INFERRED_METERS).
 * Повторяется, пока название протекает по цепочке кусков.
 * Меняет pieces на месте; возвращает число переименованных.
 */
export function adoptNeighbourNames(pieces, nodeUses) {
    const byEnd = new Map()
    for (const piece of pieces) for (const node of [piece.startNode, piece.endNode]) pushTo(byEnd, node, piece)
    let adopted = 0
    for (let changed = true; changed;) {
        changed = false
        for (const piece of pieces) {
            if (piece.nameRank === NAME_RANK.osm) continue
            if (piece.nameRank === NAME_RANK.inferred && piece.parts[0].meters > ADOPT_MAX_INFERRED_METERS) continue
            for (const node of [piece.startNode, piece.endNode]) {
                const neighbour = (byEnd.get(node) ?? []).find((other) => other !== piece)
                if (nodeUses.get(node) !== 2 || neighbour === undefined || neighbour.key === piece.key) continue
                const stronger =
                    neighbour.nameRank > piece.nameRank ||
                    (neighbour.nameRank === piece.nameRank && neighbour.nameMeters > piece.nameMeters)
                if (!stronger) continue
                piece.key = neighbour.key
                piece.parts = piece.parts.map((part) => ({
                    ...part,
                    name: neighbour.parts[0].name,
                    rank: neighbour.nameRank,
                }))
                piece.nameRank = neighbour.nameRank
                piece.nameMeters = neighbour.nameMeters
                adopted++
                changed = true
                break
            }
        }
    }
    return adopted
}

/**
 * Линия с подобранным названием (ни одного куска с названием из OSM) берёт
 * название соседней линии, если стыкуется с ней концом без развилки и
 * дорожка идёт дальше прямо (STRAIGHT_NAME_HEADING_METERS). Уступает менее
 * надёжное название, при равной надёжности — более короткая линия.
 * Работает после mergeByNodes: отдельный кусок OSM бывает короче 250 м, а
 * угол нужно мерить по всей линии. Меняет lines на месте; возвращает число
 * переименованных линий.
 */
export function adoptAlongStraight(lines, nodeUses) {
    // Сила названия линии: надёжность и длина линии, от которой оно пришло.
    // При переименовании передаётся вместе с названием и потому только растёт —
    // иначе короткая линия между двумя сильными соседями перебрасывалась бы
    // с одного названия на другое бесконечно.
    const strength = new Map(
        lines.map((line) => [
            line,
            {
                rank: Math.max(...line.parts.map((part) => part.rank)),
                meters: line.parts.reduce((sum, part) => sum + part.meters, 0),
            },
        ]),
    )
    const byEnd = new Map()
    for (const line of lines) {
        if (line.startNode !== line.endNode)
            for (const node of [line.startNode, line.endNode]) pushTo(byEnd, node, line)
    }
    let adopted = 0
    for (let changed = true; changed;) {
        changed = false
        for (const line of lines) {
            if (strength.get(line).rank !== NAME_RANK.inferred) continue
            for (const node of [line.startNode, line.endNode]) {
                const neighbour = (byEnd.get(node) ?? []).find((other) => other !== line)
                if (nodeUses.get(node) !== 2 || neighbour === undefined || neighbour.key === line.key) continue
                const [mine, theirs] = [strength.get(line), strength.get(neighbour)]
                const stronger = theirs.rank > mine.rank || (theirs.rank === mine.rank && theirs.meters > mine.meters)
                if (!stronger) continue
                const own = outwardHeading(line, line.endNode === node, STRAIGHT_NAME_HEADING_METERS)
                const next = outwardHeading(neighbour, neighbour.endNode === node, STRAIGHT_NAME_HEADING_METERS)
                if (angleDegrees(own, [-next[0], -next[1]]) > BRIDGE_MAX_TURN_DEGREES) continue
                const name = dominant(neighbour.parts, (part) => part.name)
                line.key = neighbour.key
                line.parts = line.parts.map((part) => ({ ...part, name, rank: theirs.rank }))
                strength.set(line, theirs)
                adopted++
                changed = true
                break
            }
        }
    }
    return adopted
}

/**
 * Пристёгивает кольцо разворота (замкнутую линию до RING_MAX_METERS) к
 * линии, чей конец лежит на кольце, — если такая линия ровно одна. Кольцо
 * разворачивается так, чтобы начаться в точке стыка (улица Торайгырова
 * кончается кольцом 1189593931). lines: [{ coordinates, … }].
 */
export function attachRings(lines) {
    let current = [...lines]
    const isRing = (line) => pointKey(line.coordinates[0]) === pointKey(line.coordinates[line.coordinates.length - 1])
    for (const ring of lines.filter((line) => isRing(line) && lengthMeters(line.coordinates) <= RING_MAX_METERS)) {
        const ringPoints = ring.coordinates.map(pointKey)
        const onRing = new Set(ringPoints)
        const touching = []
        for (const line of current) {
            if (line === ring || isRing(line)) continue
            if (onRing.has(pointKey(line.coordinates[line.coordinates.length - 1]))) touching.push([line, true])
            if (onRing.has(pointKey(line.coordinates[0]))) touching.push([line, false])
        }
        if (touching.length !== 1) continue
        const [line, atEnd] = touching[0]
        const oriented = atEnd ? line : reversed(line)
        const joint = ringPoints.indexOf(pointKey(oriented.coordinates[oriented.coordinates.length - 1]))
        // Кольцо без повторной замыкающей точки, начиная со стыка, и обратно в стык.
        const loop = ring.coordinates.slice(0, -1)
        const rotated = { ...ring, coordinates: [...loop.slice(joint), ...loop.slice(0, joint), loop[joint]] }
        current = current.filter((item) => item !== ring && item !== line).concat([append(oriented, rotated)])
    }
    return current
}

/**
 * Срезает загнутые кончики (см. HOOK_MAX_METERS) у свободных концов линий.
 * Конец свободен, если его точка не лежит ни на одной другой линии.
 */
export function trimHooks(lines) {
    const owners = countPointUses(lines)
    const trimEnd = (coordinates) => {
        const tipKey = pointKey(coordinates[coordinates.length - 1])
        if ((owners.get(tipKey) ?? 0) > 1) return coordinates
        if (lengthMeters(coordinates) <= 2 * HOOK_MAX_METERS) return coordinates
        // Линия возвращается в свою же точку (пристёгнутое кольцо разворота) — это не загиб.
        if (coordinates.slice(0, -1).some((coord) => pointKey(coord) === tipKey)) return coordinates
        const points = coordinates.map(project)
        const tip = points[points.length - 1]
        // Кандидаты на точку среза — от дальней (в пределах HOOK_MAX_METERS) к ближней.
        let fromTip = 0
        const cuts = []
        for (let k = points.length - 2; k > 0; k--) {
            fromTip += dist(points[k], points[k + 1])
            if (fromTip > HOOK_MAX_METERS) break
            cuts.unshift(k)
        }
        for (const k of cuts) {
            let back = k - 1
            while (back > 0 && dist(points[back], points[k]) < END_HEADING_METERS) back--
            const before = unit([points[k][0] - points[back][0], points[k][1] - points[back][1]])
            const hook = unit([tip[0] - points[k][0], tip[1] - points[k][1]])
            if (angleDegrees(before, hook) >= HOOK_MIN_TURN_DEGREES) return coordinates.slice(0, k + 1)
        }
        return coordinates
    }
    return lines.map((line) => {
        const tail = trimEnd(line.coordinates)
        const both = trimEnd([...tail].reverse()).reverse()
        return both.length === line.coordinates.length ? line : { ...line, coordinates: both }
    })
}

/** Расстояние в метрах от точки (в проекции) до линии (в проекции). */
function distanceToLine(point, linePoints) {
    let best = Infinity
    for (let i = 1; i < linePoints.length; i++)
        best = Math.min(best, segmentDistance(point, linePoints[i - 1], linePoints[i]))
    return best
}

/**
 * Убирает объезды (см. BYPASS_MAX_METERS). Идём от коротких к длинным и не
 * опираемся на уже убранную линию: на Сейфуллина два куска опираются друг
 * на друга, и без этого пропали бы оба. lines: [{ coordinates }].
 */
export function dropBypasses(lines) {
    const projected = lines.map((line) => ({
        line,
        points: line.coordinates.map(project),
        meters: lengthMeters(line.coordinates),
    }))
    const dropped = new Set()
    for (const candidate of [...projected].sort((a, b) => a.meters - b.meters)) {
        if (candidate.meters > BYPASS_MAX_METERS) break
        const [first, last] = [candidate.points[0], candidate.points[candidate.points.length - 1]]
        const host = projected.find(
            (other) =>
                other !== candidate &&
                !dropped.has(other) &&
                distanceToLine(first, other.points) <= BYPASS_ATTACH_METERS &&
                distanceToLine(last, other.points) <= BYPASS_ATTACH_METERS &&
                candidate.points.every((point) => distanceToLine(point, other.points) <= BYPASS_MAX_OFFSET_METERS),
        )
        if (host !== undefined) dropped.add(candidate)
    }
    return projected.filter((item) => !dropped.has(item)).map((item) => item.line)
}

/**
 * Склеивает группы MERGE_GROUPS в один way каждую (см. MERGE_GROUPS). Теги и
 * тип полосы — от самого длинного куска, id — наименьший. Возвращает новый
 * список way и предупреждения. ways: [{ id, coordinates, tags, lane }].
 */
export function applyMergeGroups(ways, groups = MERGE_GROUPS) {
    const byId = new Map(ways.map((way) => [way.id, way]))
    const consumed = new Set()
    const merged = []
    const warnings = []
    for (const group of groups) {
        const label = `склейка ${group.join('+')}`
        const missing = group.filter((id) => !byId.has(id))
        if (missing.length > 0) {
            warnings.push(
                `${label}: нет среди велодорожек (пропал из OSM, скрыт или не велодорожка) ${missing.join(', ')}`,
            )
        }
        // Повтор id — в этой же группе или уже склеенный в другой — дал бы
        // одну геометрию в двух линиях и два сегмента с одним id.
        const repeated = group.filter((id, i) => consumed.has(id) || group.indexOf(id) !== i)
        if (repeated.length > 0) warnings.push(`${label}: id повторяется, пропущен ${repeated.join(', ')}`)
        const parts = [...new Set(group)].filter((id) => byId.has(id) && !consumed.has(id)).map((id) => byId.get(id))
        if (parts.length < 2) continue
        const endsOf = (coords) => [project(coords[0]), project(coords[coords.length - 1])]
        // Первый кусок смотрит хвостом ко второму.
        const [first, second] = [parts[0].coordinates, parts[1].coordinates]
        const [fStart, fEnd] = endsOf(first)
        const toSecond = (point) => Math.min(...endsOf(second).map((end) => dist(point, end)))
        let coordinates = toSecond(fStart) < toSecond(fEnd) ? [...first].reverse() : [...first]
        for (const part of parts.slice(1)) {
            const tail = project(coordinates[coordinates.length - 1])
            const [start, end] = endsOf(part.coordinates)
            const flip = dist(tail, end) < dist(tail, start)
            const gap = Math.min(dist(tail, start), dist(tail, end))
            if (gap > MERGE_GROUP_MAX_GAP_METERS) {
                warnings.push(`склейка ${group.join('+')}: разрыв ${gap.toFixed(0)} м перед ${String(part.id)}`)
            }
            const next = flip ? [...part.coordinates].reverse() : part.coordinates
            coordinates = coordinates.concat(
                pointKey(next[0]) === pointKey(coordinates[coordinates.length - 1]) ? next.slice(1) : next,
            )
        }
        const longest = parts.reduce((a, b) => (lengthMeters(b.coordinates) > lengthMeters(a.coordinates) ? b : a))
        // manual: ручную склейку не проверяем как полосу-дубль — её целиком
        // могло бы выбросить из-за тегов самого длинного куска.
        merged.push({ ...longest, id: Math.min(...parts.map((part) => part.id)), coordinates, manual: true })
        for (const part of parts) consumed.add(part.id)
    }
    return { ways: ways.filter((way) => !consumed.has(way.id)).concat(merged), warnings }
}

/** Значение, которое покрывает наибольшую длину склеенной линии. */
function dominant(parts, pick) {
    const meters = new Map()
    for (const part of parts) meters.set(pick(part), (meters.get(pick(part)) ?? 0) + part.meters)
    return maxBy(meters, (total) => total)
}

/**
 * Превращает ответ Overpass в сегменты для src/data/almaty.json по конвейеру
 * из шапки файла. Тип полосы, название и описание склейки — те, что
 * покрывают большую часть её длины. id
 * сегмента — наименьший id входящего в него way OSM: он попадает в
 * deep-link `/m/bikelane/:id` и не меняется, пока этот way жив.
 */
export function buildSegments(elements) {
    const roads = []
    const bikeWays = []
    // Дорога с велополосой и с названием приходит дважды: как велодорожка и
    // как улица для подбора названий (второй оператор запроса). Без этой
    // проверки полоса рисуется двумя линиями одна поверх другой.
    const seen = new Set()
    for (const el of elements) {
        if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2 || seen.has(el.id)) continue
        seen.add(el.id)
        const tags = el.tags ?? {}
        const coordinates = el.geometry.map((g) => [roundCoord(g.lon), roundCoord(g.lat)])
        if (tags.highway !== 'cycleway' && tags.name !== undefined) roads.push({ name: osmName(tags), coordinates })
        const lane = HIDDEN_WAY_IDS.has(el.id) ? null : classifyWay(tags)
        if (lane !== null) bikeWays.push({ id: el.id, coordinates, tags, lane })
    }

    const groups = applyMergeGroups(bikeWays)
    bikeWays.splice(0, bikeWays.length, ...groups.ways)

    // Полоса на дороге проигрывает отдельной велодорожке рядом: у отдельной
    // линии точная геометрия, полоса же рисуется по оси проезжей части.
    const cyclewayIndex = buildRoadIndex(
        bikeWays
            .filter((way) => way.tags.highway === 'cycleway')
            .map((way) => ({ name: 'cycleway', coordinates: way.coordinates })),
    )
    const kept = bikeWays.filter(
        (way) => way.tags.highway === 'cycleway' || way.manual || !isDuplicateLane(way.coordinates, cyclewayIndex),
    )
    const deduped = dropDuplicateWays(kept)
    const pruned = pruneSpurs(deduped)
    // Объезды убираем и до склейки: петля с концами на другой линии создаёт в
    // точках стыка ложные развилки (Сейфуллина: 1422516696 рядом с
    // 1422516697), и куски вокруг неё не склеивались. После склейки — ещё раз,
    // для объездов, которые появились только в склеенных линиях.
    const unique = dropBypasses(pruned)

    const index = buildRoadIndex(roads)
    const pieces = unique.map((way) => {
        const osm = osmName(way.tags)
        const name = osm || (inferName(way.coordinates, index) ?? '')
        const nameRank = osm ? NAME_RANK.osm : name ? NAME_RANK.inferred : NAME_RANK.none
        const displayName = name || FALLBACK_NAME
        const meters = lengthMeters(way.coordinates)
        return {
            ids: [way.id],
            // Ключ склейки — только название: тип в OSM меняется на коротких
            // вставках (30 м вело-пешеходной посреди обособленной на
            // Жандосова), и линия рвалась бы на каждой. Без учёта регистра:
            // в OSM встречается «улица Богенбай батыра» рядом с «… Батыра».
            key: displayName.toLowerCase(),
            parts: [{ ...way.lane, name: displayName, rank: nameRank, meters }],
            nameRank,
            // Длина куска, от которого пришло название: при передаче названия
            // соседу передаётся и она (см. adoptNeighbourNames).
            nameMeters: meters,
            coordinates: way.coordinates,
            // Узел — это координата, а не id узла OSM (везде в скрипте): мост через БАК нарисован
            // своими узлами, совпадающими с концами дорожки до сантиметра, но
            // не общими с ней — по id склейка его не видела.
            startNode: pointKey(way.coordinates[0]),
            endNode: pointKey(way.coordinates[way.coordinates.length - 1]),
        }
    })

    // Источник названий считаем до adoptNeighbourNames: она меняет nameRank.
    const rankCount = (rank) => pieces.filter((piece) => piece.nameRank === rank).length
    const naming = {
        named: rankCount(NAME_RANK.osm),
        inferred: rankCount(NAME_RANK.inferred),
        fallback: rankCount(NAME_RANK.none),
    }
    const nodeUses = countPointUses(unique)
    const adoptedNames = adoptNeighbourNames(pieces, nodeUses)
    const firstPass = mergeByNodes(pieces, nodeUses)
    const straightNames = adoptAlongStraight(firstPass, nodeUses)
    const byNodes = mergeByNodes(firstPass, nodeUses)
    const withRings = attachRings(byNodes)
    const merged = mergeAcrossGaps(trimHooks(withRings))
    const withoutBypasses = dropBypasses(merged)
    const lines = withoutBypasses.filter((line) => lengthMeters(line.coordinates) >= MIN_LINE_METERS)

    const segments = lines.map((line) => {
        const laneType = dominant(line.parts, (part) => part.laneType)
        const description = dominant(line.parts, (part) => part.description ?? '')
        // Порядок ключей задаёт порядок полей в almaty.json.
        return {
            id: Math.min(...line.ids),
            // Название — от самых надёжных частей (безымянная часть длиннее
            // именованной не должна перебить название).
            name: dominant(
                line.parts.filter((part) => part.rank === Math.max(...line.parts.map((p) => p.rank))),
                (part) => part.name,
            ),
            laneType,
            laneTypeLabel: LANE_TYPES[laneType],
            distance: Math.round(lengthMeters(line.coordinates) / 10) / 100,
            ...(description && { description }),
            coordinates: line.coordinates,
        }
    })
    segments.sort((a, b) => a.id - b.id)

    const stats = {
        ways: unique.length,
        hiddenMissing: [...HIDDEN_WAY_IDS].filter((id) => !seen.has(id)),
        mergeWarnings: groups.warnings,
        ...naming,
        duplicateLanes: bikeWays.length - kept.length,
        duplicateWays: kept.length - deduped.length,
        spurs: deduped.length - pruned.length,
        adoptedNames: adoptedNames + straightNames,
        afterNodes: byNodes.length,
        rings: byNodes.length - withRings.length,
        afterGaps: merged.length,
        short: withoutBypasses.length - lines.length,
        bypasses: pruned.length - unique.length + merged.length - withoutBypasses.length,
    }
    return { segments, stats }
}

async function fetchOverpass() {
    let lastError
    for (const [attempt, url] of OVERPASS_ATTEMPTS.entries()) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, OVERPASS_RETRY_PAUSE_MS))
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                    // Без явного User-Agent Overpass отвечает 406 Not Acceptable.
                    'User-Agent': 'map.euc.kz bike-lanes updater (+https://map.euc.kz)',
                },
                body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
            })
            const text = await response.text()
            // На перегрузке Overpass отвечает 200 с XML/HTML-страницей ошибки.
            if (!response.ok || !text.startsWith('{')) {
                throw new Error(`ответ ${String(response.status)}: ${text.slice(0, 200)}`)
            }
            return JSON.parse(text)
        } catch (err) {
            console.error(`  ${url} — ${err.message}`)
            lastError = err
        }
    }
    throw new Error(`Overpass недоступен: ${lastError?.message ?? ''}`)
}

/**
 * Сериализует файл вручную: координатная пара — в одну строку.
 * JSON.stringify(data, null, 2) разворачивает каждое число на свою строку и
 * даёт дифф на десятки тысяч строк вместо реальных изменений.
 */
function serialize(segments) {
    const renderSegment = (seg) => {
        const parts = Object.entries(seg).map(([key, value]) => {
            if (key === 'coordinates') {
                const lines = value.map(([lon, lat]) => `      [${String(lon)}, ${String(lat)}]`)
                return `    "coordinates": [\n${lines.join(',\n')}\n    ]`
            }
            return `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`
        })
        return `  {\n${parts.join(',\n')}\n  }`
    }
    return `[\n${segments.map(renderSegment).join(',\n')}\n]\n`
}

async function main() {
    console.error('Запрашиваю Overpass API...')
    const { elements } = await fetchOverpass()
    console.error(`Получено объектов: ${String(elements.length)}`)

    const { segments, stats } = buildSegments(elements)
    if (stats.fallback / stats.ways > MAX_FALLBACK_SHARE) {
        throw new Error(
            `без названия ${String(stats.fallback)} из ${String(stats.ways)} кусков — в ответе Overpass не хватает улиц, файл не трогаю`,
        )
    }
    if (segments.length < MIN_SEGMENTS_TO_WRITE) {
        throw new Error(`сегментов всего ${String(segments.length)} — похоже на неполный ответ, файл не трогаю`)
    }
    await writeFile(OUT_PATH, serialize(segments))

    console.log(
        `Склейка: way OSM ${String(stats.ways)} → по общим узлам ${String(stats.afterNodes)} → через разрывы ${String(stats.afterGaps)}`,
    )
    console.log(
        `Дубли выброшены: полос вдоль отдельной дорожки ${String(stats.duplicateLanes)}, way поверх way ${String(stats.duplicateWays)}; объездов ${String(stats.bypasses)}, хвостиков ${String(stats.spurs)}, огрызков короче ${String(MIN_LINE_METERS)} м ${String(stats.short)}; колец разворота пристёгнуто ${String(stats.rings)}; названий взято у соседа: ${String(stats.adoptedNames)}`,
    )
    const totalKm = segments.reduce((sum, seg) => sum + seg.distance, 0)
    console.log(`Сегментов: ${String(segments.length)}, суммарно ${totalKm.toFixed(1)} км`)
    const byType = new Map()
    for (const seg of segments) {
        const entry = byType.get(seg.laneTypeLabel) ?? { count: 0, km: 0 }
        byType.set(seg.laneTypeLabel, { count: entry.count + 1, km: entry.km + seg.distance })
    }
    for (const [label, { count, km }] of [...byType].sort((a, b) => b[1].km - a[1].km)) {
        console.log(`  ${label}: ${String(count)} (${km.toFixed(1)} км)`)
    }
    console.log(
        `Названия: из OSM ${String(stats.named)}, по соседней улице ${String(stats.inferred)}, «${FALLBACK_NAME}» ${String(stats.fallback)}`,
    )
    for (const warning of stats.mergeWarnings) console.log(`Внимание: ${warning}`)
    if (stats.hiddenMissing.length > 0) {
        console.log(`Внимание: id из HIDDEN_WAY_IDS нет в ответе OSM: ${stats.hiddenMissing.join(', ')}`)
    }
    const kazakh = [...new Set(segments.map((seg) => seg.name).filter((name) => /[әғқңөұүһі]/iu.test(name)))]
    if (kazakh.length > 0) console.log(`Внимание: названия на казахском: ${kazakh.join(', ')}`)
    console.log('\nЭто полная замена файла — прогони lint/format:check/tsc/test/build/test:e2e перед коммитом.')
}

// Скачиваем только при прямом запуске: тесты импортируют чистые функции и
// не должны дёргать Overpass и перезаписывать файл.
const isDirectRun = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
    main().catch((err) => {
        console.error('Ошибка:', err.message)
        process.exit(1)
    })
}
