#!/usr/bin/env node
// Полная пересборка src/data/almaty.json из velojol.kz — источника истины по
// велодорожкам Алматы (см. .claude/skills/update-bike-paths/SKILL.md).
//
// Данных-эндпоинта у velojol.kz больше нет (старый
// /static/data/cities/almaty.json отдаёт 404 с 2026-07-29), но сам датасет
// живёт в HTML страницы города: инлайн-скрипт присваивает его
// `window.bikelanesData`. Скрипт скачивает страницу, вырезает этот массив,
// отбрасывает лишние поля и перезаписывает файл целиком.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'almaty.json')

const PAGE_URL = 'https://velojol.kz/city/almaty'
const CITY = 'almaty'
const GLOBAL_VAR = 'window.bikelanesData'
/** Точность координат: 6 знаков ≈ 0.1 м, исходные 14 знаков — мусорная точность. */
const COORD_PRECISION = 6

/**
 * Велодорожки velojol, которые не показываем на карте (решение владельца,
 * 2026-07-30). Дополнять по мере находок; чтобы вернуть дорожку — убрать id
 * и перегнать скрипт.
 */
const HIDDEN_IDS = new Set([
    2032, // Парк первого Президента
    2015, // Желтоксан парк
    2017, // Желтоксан парк
    1993, // Сквер имени С. Сейфуллина
    1995, // Чехова улица
    1994, // Молдагалиева улица
    // Дубли: обводят тот же путь, что уже нарисован другим сегментом (медиана
    // расстояния между трассами — единицы метров). Разбор — 2026-07-30, решения
    // владельца по каждой группе; параллельные полосы в разные стороны сюда НЕ
    // попадают, у них расхождение 8–25 м (ширина проезжей части).
    219, // лежит на 2013 «улица Саина»
    // поверх 2014 «вдоль БАК» (226 оставлен — выходит за пределы 2014)
    165,
    194,
    195,
    213,
    220,
    222,
    225,
    290, // поверх 2033 «улица Палладина»
    198, // поверх 2002 «улица Жарокова»; тот же участок, но тип полосы старый
    297, // поверх 2035 «улица Жумбаева 98»
    303, // поверх 2035 «улица Жумбаева 98»
    409, // поверх 2010 «улица Жандосова»
    292, // поверх 2034 «Макатаева (Акбулак-2)»
    438, // поверх 437
    171, // поверх 374 «улица Торайгырова»
    321, // поверх 258
    984, // поверх 2029 «улица Байтурсынова»
    1013, // поверх 2029 «улица Байтурсынова»
])

/**
 * Казахские названия velojol → русские. В датасете velojol одно поле `title`
 * без языковых вариантов (ни `title_ru`, ни `title_kk`), пишут его сами
 * пользователи — поэтому часть улиц по-казахски. UI проекта русскоязычный,
 * переводим здесь. Пополнять, когда в сводке появится «названий на казахском».
 */
const NAME_ALIASES = {
    'Байтұрсынұлы көшесі': 'улица Байтурсынова',
    'Бөгенбай Батыр көшесі': 'улица Богенбай батыра',
    'Жароков көшесі': 'улица Жарокова',
    'Жібек Жолы даңғылы': 'проспект Жибек Жолы',
    'Манас көшесі': 'улица Манаса',
    'Райымбек даңғылы': 'проспект Райымбека',
    'Шевченко көшесі': 'улица Шевченко',
    'Шоқан Уәлиханов көшесі': 'улица Валиханова',
    'Қарасай Батыр көшесі': 'улица Карасай батыра',
    'Қонаев көшесі': 'улица Конаева',
    'Өтепов көшесі': 'улица Утепова',
}

/**
 * Группы велодорожек, которые velojol хранит по кускам, а на карте это одна
 * дорожка (решение владельца, 2026-07-30). Порядок id — порядок вдоль
 * дорожки; первый id становится id склейки (его же deep-link остаётся
 * рабочим, ссылки на остальные куски перестают открываться). Тип полосы,
 * описание и оценка покрытия берутся у первого куска, длина — сумма кусков.
 */
const MERGE_GROUPS = [
    // Улица Манаса: 2031 (0.39 км) + 1014 (0.01 км) + 362 (0.04 км) + 58 (0.42 км),
    // стыки 4, 0 и 0 м. 58 в velojol назывался «Манас көшесі».
    { name: 'улица Манаса', ids: [2031, 1014, 362, 58] },
    // Роща Баума: 11 безымянных кусков velojol в одну дорожку, 6.18 км.
    // Стыки нулевые, кроме 22 м между 441 и 233.
    { name: 'Роща Баума', ids: [211, 263, 340, 248, 441, 233, 232, 212, 244, 247, 245] },
]

/** Разрыв между концами склеиваемых кусков больше этого — похоже на ошибку в группе. */
const MERGE_MAX_GAP_METERS = 60

/** Стык плотнее этого считаем одной точкой и не дублируем её в геометрии. */
const MERGE_SAME_POINT_METERS = 1

/** Типы улиц, которые переставляем вперёд. Только эти два — см. normalizeName. */
const STREET_TYPES = new Set(['улица', 'проспект'])

/**
 * Приводит название к виду «тип улицы впереди»: в velojol одна и та же улица
 * встречается как «Абая проспект», «Проспект Абая» и «проспект Абая» — в
 * списках это выглядит как три разные улицы. Трогаем только «улица» и
 * «проспект»; «тракт», «парк», «сквер» и прочее оставляем как есть (там
 * перестановка ломает название: «Ташкентский тракт» ≠ «тракт Ташкентский»).
 */
export function normalizeName(title) {
    const raw = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : ''
    const name = NAME_ALIASES[raw] ?? raw
    // По словам, а не регекспом: в JS `\b` считает границей слова только
    // ASCII, на кириллице такой шаблон молча не срабатывает.
    const words = name.split(' ')
    if (words.length < 2) return name
    const last = words[words.length - 1].toLowerCase()
    if (STREET_TYPES.has(last)) return `${last} ${words.slice(0, -1).join(' ')}`
    const first = words[0].toLowerCase()
    if (STREET_TYPES.has(first)) return `${first} ${words.slice(1).join(' ')}`
    return name
}

async function fetchCityPage() {
    const response = await fetch(PAGE_URL, {
        headers: {
            // Без явного User-Agent часть хостингов отдаёт 403 вместо страницы
            'User-Agent': 'map.euc.kz bike-lanes updater (+https://map.euc.kz)',
            Accept: 'text/html,*/*',
        },
    })
    if (!response.ok) {
        throw new Error(`${PAGE_URL} ответил ${String(response.status)} ${response.statusText}`)
    }
    return await response.text()
}

/**
 * Вырезает JSON-массив из инлайн-присваивания `window.bikelanesData = [...]`.
 * Сканирует скобки с учётом строк и escape-последовательностей: наивный
 * регексп до `];` рискует оборваться на такой же паре внутри описания.
 */
function extractGlobalArray(html, globalVar) {
    const assignmentIndex = html.indexOf(globalVar)
    if (assignmentIndex === -1) {
        throw new Error(`В HTML нет ${globalVar} — вероятно, страница поменяла разметку`)
    }
    const start = html.indexOf('[', assignmentIndex)
    if (start === -1) throw new Error(`После ${globalVar} нет открывающей скобки массива`)

    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < html.length; i++) {
        const char = html[i]
        if (inString) {
            if (escaped) escaped = false
            else if (char === '\\') escaped = true
            else if (char === '"') inString = false
            continue
        }
        if (char === '"') inString = true
        else if (char === '[' || char === '{') depth++
        else if (char === ']' || char === '}') {
            depth--
            if (depth === 0) return JSON.parse(html.slice(start, i + 1))
        }
    }
    throw new Error(`Массив ${globalVar} не закрыт — HTML обрезан?`)
}

function roundCoord(value) {
    const factor = 10 ** COORD_PRECISION
    return Math.round(value * factor) / factor
}

function pathLengthKm(coords) {
    const R = 6371
    const toRad = (deg) => (deg * Math.PI) / 180
    let total = 0
    for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i]
        const [lon2, lat2] = coords[i + 1]
        const dLat = toRad(lat2 - lat1)
        const dLon = toRad(lon2 - lon1)
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
        total += 2 * R * Math.asin(Math.sqrt(a))
    }
    return total
}

/**
 * Приводит запись velojol к тому минимуму, который рендерит карта.
 * Отброшены: автор с аватаркой, edit_url/can_edit, city*, photos/videos,
 * created_at, color (цвет слоя — из COLORS в src/constants), overall_quality
 * (вторая оценка «в целом» — в карточке не показываем, чтобы не путать с
 * качеством покрытия).
 */
function toSlimSegment(raw) {
    const coordinates = raw.geometry.coordinates.map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)])
    const description = typeof raw.description === 'string' ? raw.description.trim() : ''
    const distance = typeof raw.length === 'number' && raw.length > 0 ? raw.length : pathLengthKm(coordinates)
    const segment = {
        id: raw.id,
        name: normalizeName(raw.title),
        laneType: raw.track_type,
        laneTypeLabel: raw.track_type_display,
        distance: Math.round(distance * 100) / 100,
    }
    if (description) segment.description = description
    // quality = 0 («Не указано») смысла в карточке не несёт — не пишем
    if (typeof raw.quality === 'number' && raw.quality > 0) {
        segment.quality = raw.quality
        segment.qualityLabel = raw.quality_display
    }
    segment.coordinates = coordinates
    return segment
}

function distanceMeters(from, to) {
    return pathLengthKm([from, to]) * 1000
}

/**
 * Склеивает группы из MERGE_GROUPS в один сегмент. Куски идут в порядке id из
 * группы, каждый разворачивается тем концом, который ближе к текущему хвосту
 * цепочки (velojol рисует куски в произвольном направлении). Возвращает новый
 * список сегментов и предупреждения — их печатает сводка.
 */
export function mergeGroups(segments, groups = MERGE_GROUPS) {
    const byId = new Map(segments.map((segment) => [segment.id, segment]))
    const consumed = new Set()
    const mergedSegments = []
    const warnings = []

    for (const group of groups) {
        const parts = group.ids.map((id) => byId.get(id)).filter((part) => part !== undefined)
        const missing = group.ids.filter((id) => !byId.has(id))
        if (missing.length > 0) {
            warnings.push(`группа «${group.name}»: в датасете нет кусков ${missing.join(', ')}`)
        }
        if (parts.length < 2) {
            warnings.push(`группа «${group.name}»: склеивать нечего, осталось кусков — ${String(parts.length)}`)
            continue
        }

        const [head, ...rest] = parts
        // Первый кусок тоже разворачиваем при необходимости: velojol рисует
        // куски в произвольную сторону, и если голова стыкуется со вторым
        // куском своим началом, цепочка уходит в обратную сторону (ловили на
        // Роще Баума: разрыв 1304 м на первом же стыке).
        let coordinates = [...head.coordinates]
        const [secondStart, secondEnd] = [rest[0].coordinates[0], rest[0].coordinates[rest[0].coordinates.length - 1]]
        const fromHeadEnd = Math.min(
            distanceMeters(coordinates[coordinates.length - 1], secondStart),
            distanceMeters(coordinates[coordinates.length - 1], secondEnd),
        )
        const fromHeadStart = Math.min(
            distanceMeters(coordinates[0], secondStart),
            distanceMeters(coordinates[0], secondEnd),
        )
        if (fromHeadStart < fromHeadEnd) coordinates.reverse()

        for (const part of rest) {
            const tail = coordinates[coordinates.length - 1]
            const gapToStart = distanceMeters(tail, part.coordinates[0])
            const gapToEnd = distanceMeters(tail, part.coordinates[part.coordinates.length - 1])
            const flip = gapToEnd < gapToStart
            const gap = flip ? gapToEnd : gapToStart
            const pieceCoordinates = flip ? [...part.coordinates].reverse() : part.coordinates
            if (gap > MERGE_MAX_GAP_METERS) {
                warnings.push(
                    `группа «${group.name}»: разрыв ${gap.toFixed(0)} м перед куском ${String(part.id)} — карта нарисует прямую через этот разрыв`,
                )
            }
            // Стык в одной точке — не дублируем её, иначе в геометрии два
            // одинаковых узла подряд.
            coordinates = coordinates.concat(
                gap < MERGE_SAME_POINT_METERS ? pieceCoordinates.slice(1) : pieceCoordinates,
            )
        }

        const laneTypes = new Set(parts.map((part) => part.laneTypeLabel))
        if (laneTypes.size > 1) {
            warnings.push(
                `группа «${group.name}»: типы полос разные (${[...laneTypes].join(', ')}) — оставлен тип первого куска`,
            )
        }

        const merged = {
            id: head.id,
            name: group.name,
            laneType: head.laneType,
            laneTypeLabel: head.laneTypeLabel,
            distance: Math.round(parts.reduce((sum, part) => sum + part.distance, 0) * 100) / 100,
        }
        if (head.description !== undefined) merged.description = head.description
        if (head.quality !== undefined) {
            merged.quality = head.quality
            merged.qualityLabel = head.qualityLabel
        }
        merged.coordinates = coordinates

        for (const part of parts) consumed.add(part.id)
        mergedSegments.push(merged)
    }

    const result = segments.filter((segment) => !consumed.has(segment.id)).concat(mergedSegments)
    return { segments: result, warnings, mergedCount: mergedSegments.length, consumedCount: consumed.size }
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
    console.error(`Скачиваю ${PAGE_URL}...`)
    const html = await fetchCityPage()
    const raw = extractGlobalArray(html, GLOBAL_VAR)
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error(`${GLOBAL_VAR} пуст — velojol отдал страницу без данных, файл не трогаю`)
    }
    console.error(`Получено записей: ${String(raw.length)}`)

    const stats = { otherCity: 0, busLane: 0, badGeometry: 0, hidden: 0, renamed: 0, aliased: 0 }
    const hiddenNotFound = new Set(HIDDEN_IDS)
    const usedAliases = new Set()
    const kept = []
    for (const item of raw) {
        if (item.city !== CITY) {
            stats.otherCity++
            continue
        }
        // Отмечаем алиас как живой до фильтров: скрытая дорожка всё ещё есть в
        // velojol, и предупреждать «алиас не пригодился» тут не о чем.
        const title = typeof item.title === 'string' ? item.title.replace(/\s+/g, ' ').trim() : ''
        if (NAME_ALIASES[title] !== undefined) usedAliases.add(title)
        if (HIDDEN_IDS.has(item.id)) {
            stats.hidden++
            hiddenNotFound.delete(item.id)
            continue
        }
        // Автобусные полосы — решение владельца (2026-07-30): на карте EUC
        // показываем только велоинфраструктуру, иначе слой «Велодорожки»
        // наполовину состоит из полос для автобусов с авто-названиями.
        if (item.is_bus_lane === true) {
            stats.busLane++
            continue
        }
        if (item.geometry?.type !== 'LineString' || !Array.isArray(item.geometry.coordinates)) {
            stats.badGeometry++
            continue
        }
        if (item.geometry.coordinates.length < 2) {
            stats.badGeometry++
            continue
        }
        const segment = toSlimSegment(item)
        if (segment.name !== title) stats.renamed++
        if (NAME_ALIASES[title] !== undefined) stats.aliased++
        kept.push(segment)
    }

    if (kept.length === 0) {
        throw new Error('После фильтров не осталось ни одного сегмента — файл не трогаю')
    }

    const merge = mergeGroups(kept)
    const result = merge.segments

    // Сортировка по id: velojol отдаёт записи в порядке правок, из-за этого
    // дифф каждый раз перемешивал весь файл.
    result.sort((a, b) => a.id - b.id)

    await writeFile(OUT_PATH, serialize(result))

    const byType = new Map()
    for (const seg of result) byType.set(seg.laneTypeLabel, (byType.get(seg.laneTypeLabel) ?? 0) + 1)
    const totalKm = result.reduce((sum, seg) => sum + seg.distance, 0)
    const autoNamed = result.filter((seg) => /№\s*\d+$/.test(seg.name)).length
    const withDescription = result.filter((seg) => seg.description !== undefined).length
    const withQuality = result.filter((seg) => seg.quality !== undefined).length

    console.log(`Сегментов: ${String(result.length)}, суммарно ${totalKm.toFixed(1)} км`)
    for (const [label, count] of [...byType].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${label}: ${String(count)}`)
    }
    console.log(`С описанием: ${String(withDescription)}, с оценкой покрытия: ${String(withQuality)}`)
    console.log(`Названий-заглушек «… №N»: ${String(autoNamed)}`)
    console.log(
        `Названий переписано: ${String(stats.renamed)} (переведено по NAME_ALIASES: ${String(stats.aliased)}, остальное — единый формат «улица X» / «проспект X»)`,
    )
    const unusedAliases = Object.keys(NAME_ALIASES).filter((key) => !usedAliases.has(key))
    if (unusedAliases.length > 0) {
        // Как и HIDDEN_IDS, словарь не должен молча гнить: в velojol могли
        // переименовать улицу или удалить последний сегмент с этим названием.
        console.log(`Внимание: алиасы не пригодились (нет таких названий в velojol): ${unusedAliases.join(', ')}`)
    }
    // Казахские буквы, которых нет в русском алфавите, — сигнал, что появилось
    // новое непереведённое название и словарь пора пополнить.
    const stillKazakh = [...new Set(result.map((seg) => seg.name).filter((name) => /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/u.test(name)))]
    if (stillKazakh.length > 0) {
        console.log(`Внимание: названий на казахском без перевода: ${stillKazakh.join(', ')}`)
    }
    console.log(
        `Отфильтровано: автобусных полос ${String(stats.busLane)}, скрытых вручную ${String(stats.hidden)}, другой город ${String(stats.otherCity)}, битая геометрия ${String(stats.badGeometry)}`,
    )
    if (hiddenNotFound.size > 0) {
        // Список HIDDEN_IDS не должен молча гнить: velojol мог удалить или
        // перенумеровать эти объекты, тогда id пора убрать из скрипта.
        console.log(`Внимание: id из HIDDEN_IDS нет в датасете velojol: ${[...hiddenNotFound].join(', ')}`)
    }
    console.log(`Склеено групп: ${String(merge.mergedCount)} (из ${String(merge.consumedCount)} кусков velojol)`)
    for (const warning of merge.warnings) console.log(`Внимание: ${warning}`)
    console.log('\nЭто полная замена файла — прогони lint/format:check/tsc/test/build/test:e2e перед коммитом.')
}

// Скачиваем только при прямом запуске: тесты импортируют normalizeName и
// не должны при этом дёргать velojol и перезаписывать файл.
const isDirectRun = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
    main().catch((err) => {
        console.error('Ошибка:', err.message)
        process.exit(1)
    })
}
