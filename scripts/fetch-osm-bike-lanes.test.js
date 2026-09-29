import { describe, it, expect } from 'vitest'
import {
    classifyWay,
    osmName,
    inferName,
    buildRoadIndex,
    buildSegments,
    mergeByNodes,
    mergeAcrossGaps,
    isDuplicateLane,
    dropDuplicateWays,
    adoptNeighbourNames,
    dropBypasses,
    pruneSpurs,
    attachRings,
    trimHooks,
    adoptAlongStraight,
    HIDDEN_WAY_IDS,
    applyMergeGroups,
} from './fetch-osm-bike-lanes.js'

/** Элемент ответа Overpass: way с тегами и геометрией. */
function osmWay(id, tags, coords) {
    return { type: 'way', id, tags, geometry: coords.map(([lon, lat]) => ({ lon, lat })) }
}

describe('classifyWay (какие way OSM — велодорожки)', () => {
    it('отдельная велодорожка: обособленная или вело-пешеходная', () => {
        expect(classifyWay({ highway: 'cycleway' })).toEqual({ laneType: 'separated' })
        expect(classifyWay({ highway: 'cycleway', foot: 'designated', segregated: 'yes' })).toEqual({
            laneType: 'separated',
        })
        expect(classifyWay({ highway: 'cycleway', foot: 'designated' })).toEqual({ laneType: 'shared' })
    })

    it('пропускает трассы кросс-кантри', () => {
        expect(classifyWay({ highway: 'cycleway', name: 'XCO Alatau' })).toBeNull()
        expect(classifyWay({ highway: 'cycleway', name: 'Alatau XCO' })).toBeNull()
    })

    it('пропускает строящиеся участки', () => {
        // Тимирязева, way 1332903190: в OSM «строится» — на карту не берём
        expect(classifyWay({ highway: 'construction', construction: 'cycleway', bicycle: 'yes' })).toBeNull()
    })

    it('пропускает переезды через дорогу', () => {
        expect(classifyWay({ highway: 'cycleway', cycleway: 'crossing' })).toBeNull()
        expect(classifyWay({ highway: 'cycleway', footway: 'crossing' })).toBeNull()
    })

    it('полоса на дороге — с указанием, если с обеих сторон', () => {
        expect(classifyWay({ highway: 'secondary', 'cycleway:right': 'lane' })).toEqual({ laneType: 'lane' })
        expect(classifyWay({ highway: 'secondary', 'cycleway:both': 'lane' })).toEqual({
            laneType: 'lane',
            description: 'С обеих сторон дороги',
        })
        expect(classifyWay({ highway: 'secondary', 'cycleway:left': 'lane', 'cycleway:right': 'track' })).toEqual({
            laneType: 'separated',
            description: 'С обеих сторон дороги',
        })
    })

    it('не рисует дорогу, чья велодорожка нарисована отдельно, и общие полосы', () => {
        // separate — дорожка уже есть отдельным way; иначе будет дубль вдоль оси дороги
        expect(classifyWay({ highway: 'primary', 'cycleway:both': 'separate' })).toBeNull()
        expect(classifyWay({ highway: 'primary', cycleway: 'no' })).toBeNull()
        expect(classifyWay({ highway: 'primary', cycleway: 'shared_lane' })).toBeNull()
        expect(classifyWay({ highway: 'primary', cycleway: 'share_busway' })).toBeNull()
        expect(classifyWay({ highway: 'primary', name: 'проспект Абая' })).toBeNull()
    })
})

describe('osmName', () => {
    it('берёт русское название, иначе name, и сводит варианты по словарю', () => {
        expect(osmName({ name: 'Абай даңғылы', 'name:ru': 'проспект Абая' })).toBe('проспект Абая')
        expect(osmName({ name: 'улица Гоголя' })).toBe('улица Гоголя')
        expect(osmName({ 'name:ru': 'улица Каныша Сатпаева' })).toBe('улица Сатпаева')
        expect(osmName({})).toBe('')
    })
})

// Улица вдоль меридиана 76.9 и поперечная вдоль параллели 43.245.
const alongStreet = {
    name: 'улица Вдоль',
    coordinates: [
        [76.9, 43.24],
        [76.9, 43.25],
    ],
}
const crossStreet = {
    name: 'улица Поперёк',
    coordinates: [
        [76.89, 43.245],
        [76.91, 43.245],
    ],
}

describe('inferName (название безымянной дорожки по соседней улице)', () => {
    const index = buildRoadIndex([alongStreet, crossStreet])

    it('берёт улицу, вдоль которой идёт дорожка, а не поперечную', () => {
        // ~20 м восточнее оси улицы, пересекает поперечную посередине
        expect(
            inferName(
                [
                    [76.90025, 43.241],
                    [76.90025, 43.249],
                ],
                index,
            ),
        ).toBe('улица Вдоль')
    })

    it('возвращает null, если улиц рядом нет', () => {
        expect(
            inferName(
                [
                    [76.95, 43.3],
                    [76.95, 43.31],
                ],
                index,
            ),
        ).toBeNull()
    })

    it('возвращает null, если ни одна улица не набрала нужной доли длины', () => {
        // Дорожка лишь касается улицы своим концом
        expect(
            inferName(
                [
                    [76.9, 43.24],
                    [76.92, 43.24],
                ],
                index,
            ),
        ).toBeNull()
    })
})

describe('buildSegments (ответ Overpass → almaty.json)', () => {
    it('имя из OSM, по соседней улице или заглушка', () => {
        const { segments, stats } = buildSegments([
            osmWay(20, { highway: 'residential', name: alongStreet.name }, alongStreet.coordinates),
            osmWay(10, { highway: 'cycleway', name: 'Аллея' }, [
                [76.91, 43.24],
                [76.91, 43.241],
            ]),
            osmWay(30, { highway: 'cycleway' }, [
                [76.90025, 43.241],
                [76.90025, 43.249],
            ]),
            osmWay(40, { highway: 'cycleway' }, [
                [77.05, 43.3],
                [77.05, 43.301],
            ]),
        ])
        expect(segments.map((s) => [s.id, s.name])).toEqual([
            [10, 'Аллея'],
            [30, 'улица Вдоль'],
            [40, 'Велодорожка'],
        ])
        expect(stats).toMatchObject({ ways: 3, named: 1, inferred: 1, fallback: 1 })
        expect(segments[0]).toMatchObject({ laneType: 'separated', laneTypeLabel: 'Обособленная велодорожка' })
        expect(segments[0].distance).toBeCloseTo(0.11, 2)
    })

    it('не задваивает дорогу, пришедшую и как велополоса, и как улица для названий', () => {
        const road = osmWay(50, { highway: 'secondary', name: 'улица Ы', 'cycleway:right': 'lane' }, [
            [76.9, 43.24],
            [76.9, 43.25],
        ])
        const { segments } = buildSegments([road, road])
        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({ id: 50, name: 'улица Ы', laneType: 'lane' })
    })

    it('округляет координаты до 6 знаков', () => {
        const { segments } = buildSegments([
            osmWay(1, { highway: 'cycleway' }, [
                [76.123456789, 43.987654321],
                [76.2, 43.9],
            ]),
        ])
        expect(segments[0].coordinates[0]).toEqual([76.123457, 43.987654])
    })
})

/** Кусок для склейки: id, key, координаты, узлы концов. */
function piece(id, coordinates, { key = 'улица А', startNode = `s${String(id)}`, endNode = `e${String(id)}` } = {}) {
    return {
        ids: [id],
        key,
        parts: [{ laneType: 'separated', meters: 100 }],
        coordinates,
        startNode,
        endNode,
    }
}

/** Все узлы кусков встречаются по разу на конец — развилок нет. */
function usesOf(lines) {
    const uses = new Map()
    for (const line of lines)
        for (const node of [line.startNode, line.endNode]) uses.set(node, (uses.get(node) ?? 0) + 1)
    return uses
}

describe('mergeByNodes (склейка по общему узлу OSM)', () => {
    it('собирает цепочку кусков одной улицы, разворачивая встречные', () => {
        const lines = [
            piece(
                1,
                [
                    [76.9, 43.24],
                    [76.9, 43.241],
                ],
                { startNode: 'a', endNode: 'b' },
            ),
            // нарисован в обратную сторону
            piece(
                2,
                [
                    [76.9, 43.242],
                    [76.9, 43.241],
                ],
                { startNode: 'c', endNode: 'b' },
            ),
            piece(
                3,
                [
                    [76.9, 43.242],
                    [76.9, 43.243],
                ],
                { startNode: 'c', endNode: 'd' },
            ),
        ]
        const merged = mergeByNodes(lines, usesOf(lines))
        expect(merged).toHaveLength(1)
        expect(merged[0].ids.sort()).toEqual([1, 2, 3])
        expect(merged[0].coordinates.map(([, lat]) => lat)).toEqual([43.24, 43.241, 43.242, 43.243].sort())
    })

    it('не клеит через развилку, даже если третья дорожка с другим названием', () => {
        // Проспект Райымбека: две одноимённые и одна безымянная сходятся в
        // одном узле — склейка разворачивала линию назад.
        const lines = [
            piece(
                1,
                [
                    [76.9, 43.24],
                    [76.9, 43.241],
                ],
                { startNode: 'a', endNode: 'x' },
            ),
            piece(
                2,
                [
                    [76.9, 43.241],
                    [76.9, 43.242],
                ],
                { startNode: 'x', endNode: 'b' },
            ),
            piece(
                3,
                [
                    [76.9, 43.241],
                    [76.91, 43.241],
                ],
                { key: 'Велодорожка', startNode: 'x', endNode: 'c' },
            ),
        ]
        expect(mergeByNodes(lines, usesOf(lines))).toHaveLength(3)
    })

    it('не клеит куски с разным названием', () => {
        const lines = [
            piece(
                1,
                [
                    [76.9, 43.24],
                    [76.9, 43.241],
                ],
                { startNode: 'a', endNode: 'x' },
            ),
            piece(
                2,
                [
                    [76.9, 43.241],
                    [76.9, 43.242],
                ],
                { key: 'улица Б', startNode: 'x', endNode: 'b' },
            ),
        ]
        expect(mergeByNodes(lines, usesOf(lines))).toHaveLength(2)
    })
})

describe('mergeAcrossGaps (склейка через разрыв у перекрёстка)', () => {
    // 0.0001° широты ≈ 11 м
    const north = piece(1, [
        [76.9, 43.24],
        [76.9, 43.241],
    ])

    it('клеит продолжение той же улицы через разрыв ~15 м', () => {
        const next = piece(2, [
            [76.9, 43.24115],
            [76.9, 43.242],
        ])
        const merged = mergeAcrossGaps([north, next])
        expect(merged).toHaveLength(1)
        expect(merged[0].coordinates).toEqual([
            [76.9, 43.24],
            [76.9, 43.241],
            [76.9, 43.24115],
            [76.9, 43.242],
        ])
    })

    it('клеит разрыв ~35 м через перекрёсток (Жандосова), но не больше порога', () => {
        expect(
            mergeAcrossGaps([
                north,
                piece(2, [
                    [76.9, 43.24133],
                    [76.9, 43.242],
                ]),
            ]),
        ).toHaveLength(1)
        expect(
            mergeAcrossGaps([
                north,
                // ~110 м — больше даже порога для строго прямых
                piece(2, [
                    [76.9, 43.2421],
                    [76.9, 43.242],
                ]),
            ]),
        ).toHaveLength(2)
    })

    it('длинный разрыв (~85 м, Тимирязева) клеит только строго по прямой', () => {
        // 0.00077° ≈ 85 м к северу
        const straight = piece(2, [
            [76.9, 43.24177],
            [76.9, 43.243],
        ])
        expect(mergeAcrossGaps([north, straight])).toHaveLength(1)
        // тот же разрыв, но перемычка уходит вбок на ~20°
        const skewed = piece(2, [
            [76.9004, 43.24172],
            [76.9008, 43.243],
        ])
        expect(mergeAcrossGaps([north, skewed])).toHaveLength(2)
    })

    it('не клеит поперечную дорожку, растущую «из середины»', () => {
        // Подходит к концу north под прямым углом с востока
        const branch = piece(2, [
            [76.9001, 43.241],
            [76.901, 43.241],
        ])
        expect(mergeAcrossGaps([north, branch])).toHaveLength(2)
    })

    it('на длинном разрыве клеит переход с полосы на тротуарную дорожку со сдвигом ~8 м (Манаса)', () => {
        // ~80 м вперёд и ~8 м вбок (0.0001° долготы)
        const sidewalk = piece(2, [
            [76.9001, 43.24172],
            [76.9001, 43.243],
        ])
        expect(mergeAcrossGaps([north, sidewalk])).toHaveLength(1)
    })

    it('на длинном разрыве не перескакивает на другую сторону улицы (Жумабаева)', () => {
        // ~85 м вперёд и 13 м вбок: угол всего ~9°, но это уже встречная сторона
        const across = piece(2, [
            [76.90016, 43.24177],
            [76.90016, 43.243],
        ])
        expect(mergeAcrossGaps([north, across])).toHaveLength(2)
    })

    it('клеит с явно ближайшим, если второй кандидат заметно дальше (Саина)', () => {
        const near = piece(2, [
            [76.9, 43.2411],
            [76.9, 43.2415],
        ])
        const far = piece(3, [
            [76.9, 43.2417],
            [76.9, 43.243],
        ])
        const merged = mergeAcrossGaps([north, near, far])
        expect(merged).toHaveLength(1)
        expect([...merged[0].ids].sort()).toEqual([1, 2, 3])
    })

    it('у перекрёстка клеит каждую сторону улицы со своей (Гоголя)', () => {
        // Две стороны в ~20 м друг от друга (0.00025° долготы), разрыв ~23 м
        const westA = piece(1, [
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const eastA = piece(2, [
            [76.9, 43.24121],
            [76.9, 43.242],
        ])
        const westB = piece(3, [
            [76.90025, 43.24],
            [76.90025, 43.24095],
        ])
        const eastB = piece(4, [
            [76.90025, 43.24121],
            [76.90025, 43.242],
        ])
        const merged = mergeAcrossGaps([westA, eastA, westB, eastB])
        expect(merged.map((line) => [...line.ids].sort())).toEqual(
            expect.arrayContaining([
                [1, 2],
                [3, 4],
            ]),
        )
        expect(merged).toHaveLength(2)
    })

    it('не разворачивается на дорожку по другой стороне улицы', () => {
        // Встречная дорожка в ~15 м восточнее, идёт обратно на юг
        const opposite = piece(2, [
            [76.90018, 43.241],
            [76.90018, 43.24],
        ])
        expect(mergeAcrossGaps([north, opposite])).toHaveLength(2)
    })

    it('не клеит под углом (поперечная улица с тем же названием)', () => {
        const turn = piece(2, [
            [76.90005, 43.2411],
            [76.901, 43.2411],
        ])
        expect(mergeAcrossGaps([north, turn])).toHaveLength(2)
    })

    it('не клеит куски с разным названием, безымянные — клеит', () => {
        const next = [
            [76.9, 43.24115],
            [76.9, 43.242],
        ]
        expect(mergeAcrossGaps([north, piece(2, next, { key: 'улица Б' })])).toHaveLength(2)
        const unnamed = [piece(1, north.coordinates, { key: 'велодорожка' }), piece(2, next, { key: 'велодорожка' })]
        expect(mergeAcrossGaps(unnamed)).toHaveLength(1)
    })

    it('замыкает кольцо, концы которого разошлись бок о бок на ~8 м (парк)', () => {
        // Конец north смотрит на север; продолжение начинается в 8 м восточнее
        // и тоже уходит на север — перемычка смотрит вбок, но разрыв короткий.
        const beside = piece(2, [
            [76.9001, 43.241],
            [76.9001, 43.242],
        ])
        expect(mergeAcrossGaps([north, beside])).toHaveLength(1)
    })

    it('при двух кандидатах не клеит ни с одним', () => {
        const a = piece(2, [
            [76.9, 43.24115],
            [76.9, 43.242],
        ])
        const b = piece(3, [
            [76.90003, 43.24112],
            [76.90003, 43.242],
        ])
        expect(mergeAcrossGaps([north, a, b])).toHaveLength(3)
    })
})

describe('buildSegments — склейка', () => {
    it('клеит куски разного типа, тип — по большей длине', () => {
        // Жандосова: 30 м вело-пешеходной перед обособленной велодорожкой
        const tags = { highway: 'cycleway', name: 'улица Ораза Жандосова' }
        const { segments } = buildSegments([
            osmWay(1, { ...tags, foot: 'designated' }, [
                [76.9, 43.24],
                [76.9, 43.2403],
            ]),
            osmWay(2, tags, [
                [76.9, 43.2403],
                [76.9, 43.242],
            ]),
        ])
        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({ id: 1, laneType: 'separated', laneTypeLabel: 'Обособленная велодорожка' })
    })

    it('id склеенной дорожки — наименьший id way, длина — сумма', () => {
        const tags = { highway: 'secondary', name: 'улица Сатпаева', 'cycleway:right': 'lane' }
        const { segments, stats } = buildSegments([
            osmWay(30, tags, [
                [76.9, 43.24],
                [76.9, 43.241],
            ]),
            osmWay(20, tags, [
                [76.9, 43.241],
                [76.9, 43.242],
            ]),
        ])
        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({ id: 20, name: 'улица Сатпаева', laneType: 'lane' })
        expect(segments[0].distance).toBeCloseTo(0.22, 2)
        expect(stats).toMatchObject({ ways: 2, afterNodes: 1, afterGaps: 1 })
    })
})

describe('isDuplicateLane (полоса на дороге вдоль отдельной велодорожки)', () => {
    // Отдельная велодорожка вдоль меридиана 76.9, ~1.1 км
    const index = buildRoadIndex([
        {
            name: 'x',
            coordinates: [
                [76.9, 43.24],
                [76.9, 43.25],
            ],
        },
    ])

    it('полоса в ~6 м от велодорожки — дубль (Богенбай Батыра)', () => {
        expect(
            isDuplicateLane(
                [
                    [76.90007, 43.241],
                    [76.90007, 43.244],
                ],
                index,
            ),
        ).toBe(true)
    })

    it('полоса по другой стороне широкой улицы (~25 м) — не дубль', () => {
        expect(
            isDuplicateLane(
                [
                    [76.9003, 43.241],
                    [76.9003, 43.244],
                ],
                index,
            ),
        ).toBe(false)
    })

    it('короткий кусок дороги на перекрёстке не проверяем', () => {
        expect(
            isDuplicateLane(
                [
                    [76.9, 43.241],
                    [76.9, 43.2412],
                ],
                index,
            ),
        ).toBe(false)
    })
})

describe('buildSegments — дубли и регистр названий', () => {
    it('выбрасывает полосу-дубль и склеивает названия без учёта регистра', () => {
        const { segments, stats } = buildSegments([
            osmWay(1, { highway: 'cycleway', name: 'улица Богенбай Батыра' }, [
                [76.9, 43.24],
                [76.9, 43.243],
            ]),
            osmWay(2, { highway: 'cycleway', name: 'улица Богенбай батыра' }, [
                [76.9, 43.243],
                [76.9, 43.244],
            ]),
            osmWay(3, { highway: 'secondary', name: 'улица Богенбай Батыра', 'cycleway:left': 'lane' }, [
                [76.90007, 43.2405],
                [76.90007, 43.2425],
            ]),
        ])
        expect(stats.duplicateLanes).toBe(1)
        expect(segments).toHaveLength(1)
        // Написание — то, что покрывает большую длину
        expect(segments[0]).toMatchObject({ id: 1, name: 'улица Богенбай Батыра', laneType: 'separated' })
    })
})

describe('dropDuplicateWays (дубли в данных OSM)', () => {
    it('убирает короткий way, лежащий поверх длинного', () => {
        const long = {
            id: 1,
            coordinates: [
                [76.9, 43.24],
                [76.9, 43.25],
            ],
        }
        const copy = {
            id: 2,
            coordinates: [
                [76.9, 43.242],
                [76.9, 43.243],
            ],
        }
        expect(dropDuplicateWays([long, copy]).map((way) => way.id)).toEqual([1])
    })

    it('не трогает соседние дорожки и последовательные куски', () => {
        const a = {
            id: 1,
            coordinates: [
                [76.9, 43.24],
                [76.9, 43.241],
            ],
        }
        const next = {
            id: 2,
            coordinates: [
                [76.9, 43.241],
                [76.9, 43.242],
            ],
        }
        const parallel = {
            id: 3,
            coordinates: [
                [76.9001, 43.24],
                [76.9001, 43.241],
            ],
        }
        expect(dropDuplicateWays([a, next, parallel])).toHaveLength(3)
    })
})

describe('adoptNeighbourNames (название от соседа)', () => {
    const make = (id, name, nameRank, meters, startNode, endNode) => ({
        ids: [id],
        key: name.toLowerCase(),
        parts: [{ laneType: 'separated', name, meters }],
        nameRank,
        nameMeters: meters,
        startNode,
        endNode,
    })

    it('безымянный берёт название соседа, и дальше по цепочке', () => {
        const pieces = [
            make(1, 'улица Саина', 2, 1000, 'a', 'b'),
            make(2, 'Велодорожка', 0, 600, 'b', 'c'),
            make(3, 'Велодорожка', 0, 100, 'c', 'd'),
        ]
        expect(adoptNeighbourNames(pieces, usesOf(pieces))).toBe(2)
        expect(pieces.map((p) => p.key)).toEqual(['улица саина', 'улица саина', 'улица саина'])
    })

    it('короткий кусок с подобранным названием уступает соседу (мост через БАК)', () => {
        const pieces = [make(1, 'Улица вдоль БАКа', 1, 2000, 'a', 'b'), make(2, 'улица БАК', 1, 80, 'b', 'c')]
        adoptNeighbourNames(pieces, usesOf(pieces))
        expect(pieces[1].parts[0].name).toBe('Улица вдоль БАКа')
    })

    it('длинный кусок с подобранным названием и название из OSM не уступают', () => {
        const corner = [make(1, 'Улица вдоль БАКа', 1, 5000, 'a', 'b'), make(2, 'улица Саина', 1, 1200, 'b', 'c')]
        expect(adoptNeighbourNames(corner, usesOf(corner))).toBe(0)
        const osm = [make(1, 'улица А', 2, 5000, 'a', 'b'), make(2, 'улица Б', 2, 50, 'b', 'c')]
        expect(adoptNeighbourNames(osm, usesOf(osm))).toBe(0)
    })

    it('не берёт название через развилку', () => {
        const pieces = [make(1, 'улица А', 2, 500, 'a', 'x'), make(2, 'Велодорожка', 0, 100, 'x', 'c')]
        const nodeUses = usesOf(pieces)
        nodeUses.set('x', 3)
        expect(adoptNeighbourNames(pieces, nodeUses)).toBe(0)
    })
})

describe('dropBypasses (объезды «из середины» линии)', () => {
    // Полоса вдоль меридиана 76.9, ~1.1 км
    const main = {
        id: 'main',
        coordinates: [
            [76.9, 43.24],
            [76.9, 43.25],
        ],
    }

    it('убирает короткую петлю в стороне от линии (Макатаева)', () => {
        // Концы на линии, середина в ~8 м (0.0001° долготы) в стороне
        const loop = {
            id: 'loop',
            coordinates: [
                [76.9, 43.245],
                [76.9001, 43.2451],
                [76.9, 43.2452],
            ],
        }
        expect(dropBypasses([main, loop]).map((line) => line.id)).toEqual(['main'])
    })

    it('не трогает петлю, отходящую далеко, и длинные линии', () => {
        const far = {
            id: 'far',
            coordinates: [
                [76.9, 43.245],
                [76.9005, 43.2451],
                [76.9, 43.2452],
            ],
        }
        const long = {
            id: 'long',
            coordinates: [
                [76.9, 43.241],
                [76.9001, 43.2425],
                [76.9, 43.244],
            ],
        }
        expect(dropBypasses([main, far, long])).toHaveLength(3)
    })

    it('из двух опирающихся друг на друга кусков убирает только короткий (Сейфуллина)', () => {
        const lane = {
            id: 'lane',
            coordinates: [
                [76.9, 43.24],
                [76.9, 43.2404],
            ],
        }
        const track = {
            id: 'track',
            coordinates: [
                [76.9, 43.24],
                [76.9001, 43.2402],
                [76.9, 43.2404],
            ],
        }
        expect(dropBypasses([lane, track]).map((line) => line.id)).toEqual(['track'])
    })
})

describe('pruneSpurs (висячие хвостики у развилки)', () => {
    const way = (id, coordinates) => ({ id, coordinates })
    // Перекрёсток в точке X; 0.0001° широты ≈ 11 м
    const X = [76.9, 43.24]

    it('убирает короткий хвостик, растущий из развилки (Манаса × Абая)', () => {
        const ways = [way(1, [[76.9, 43.237], X]), way(2, [X, [76.899, 43.2405]]), way(3, [X, [76.9, 43.24008]])]
        expect(pruneSpurs(ways).map((w) => w.id)).toEqual([1, 2])
    })

    it('не трогает короткий последний кусок линии у разрыва (Тимирязева)', () => {
        const ways = [way(1, [[76.9, 43.237], X]), way(2, [X, [76.9, 43.24008]])]
        expect(pruneSpurs(ways)).toHaveLength(2)
    })

    it('не трогает короткую перемычку и отдельно стоящий кусок', () => {
        const ways = [
            way(1, [[76.9, 43.237], X]),
            way(2, [X, [76.899, 43.2405]]),
            way(3, [X, [76.9, 43.24008]]),
            way(4, [
                [76.9, 43.24008],
                [76.9, 43.243],
            ]),
            way(5, [
                [77.0, 43.3],
                [77.0, 43.30008],
            ]),
        ]
        expect(pruneSpurs(ways)).toHaveLength(5)
    })
})

describe('attachRings (кольцо разворота на конце линии)', () => {
    // Кольцо ~40×40 м с вершиной в конце линии
    const ring = {
        id: 'ring',
        coordinates: [
            [76.9, 43.241],
            [76.9005, 43.241],
            [76.9005, 43.2414],
            [76.9, 43.2414],
            [76.9, 43.241],
        ],
    }
    const line = (coordinates) => ({ ids: [1], parts: [], key: 'улица а', coordinates })

    it('пристёгивает кольцо к линии, упёршейся в него (Торайгырова)', () => {
        const street = line([
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const result = attachRings([street, { ...ring, ids: [2], parts: [] }])
        expect(result).toHaveLength(1)
        const coords = result[0].coordinates
        expect(coords[0]).toEqual([76.9, 43.24])
        // Кольцо обходится целиком и возвращается в точку стыка
        expect(coords.slice(1)).toEqual(ring.coordinates)
    })

    it('не пристёгивает кольцо, если в него упираются две линии', () => {
        const a = line([
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const b = line([
            [76.901, 43.2414],
            [76.9005, 43.2414],
        ])
        expect(attachRings([a, b, { ...ring, ids: [2], parts: [] }])).toHaveLength(3)
    })
})

describe('trimHooks (загнутый кончик у свободного конца)', () => {
    // Линия на восток ~160 м, в конце загиб на север ~24 м (Утепова)
    const hooked = [
        [76.9, 43.24],
        [76.902, 43.24],
        [76.902, 43.24022],
    ]

    it('срезает загиб под прямым углом на свободном конце', () => {
        const [trimmed] = trimHooks([{ coordinates: hooked }])
        expect(trimmed.coordinates).toEqual(hooked.slice(0, 2))
    })

    it('не трогает загиб, если кончик соединён с другой линией', () => {
        const other = {
            coordinates: [
                [76.902, 43.24022],
                [76.903, 43.241],
            ],
        }
        const [kept] = trimHooks([{ coordinates: hooked }, other])
        expect(kept.coordinates).toEqual(hooked)
    })

    it('не трогает плавный поворот', () => {
        const gentle = [
            [76.9, 43.24],
            [76.902, 43.24],
            [76.9022, 43.24005],
        ]
        const [kept] = trimHooks([{ coordinates: gentle }])
        expect(kept.coordinates).toEqual(gentle)
    })
})

describe('adoptAlongStraight (подобранное название на прямом продолжении)', () => {
    // Линия из одного куска с подобранным названием; стык — в точке J
    const J = [76.9, 43.24]
    const line = (name, rank, coordinates) => ({
        ids: [1],
        key: name.toLowerCase(),
        parts: [{ laneType: 'separated', name, rank, meters: 1000 }],
        coordinates,
        startNode: coordinates[0].join(),
        endNode: coordinates[coordinates.length - 1].join(),
    })
    const usesOfLines = (lines) => {
        const map = new Map()
        for (const l of lines) for (const n of [l.startNode, l.endNode]) map.set(n, (map.get(n) ?? 0) + 1)
        return map
    }

    it('на прямой берёт название более длинной соседней линии (Абая → Нурпеисова)', () => {
        const abay = line('проспект Абая', 1, [[76.89, 43.24], J])
        abay.parts[0].meters = 800
        const short = line('улица Нурпеисова', 1, [J, [76.904, 43.2401]])
        short.parts[0].meters = 300
        const lines = [abay, short]
        expect(adoptAlongStraight(lines, usesOfLines(lines))).toBe(1)
        expect(short.key).toBe('проспект абая')
    })

    it('на углу названия не трогает (Утепова / Кекилбайулы)', () => {
        const west = line('улица Утепова', 1, [[76.89, 43.24], J])
        const south = line('улица Абиша Кекилбайулы', 1, [J, [76.9, 43.23]])
        south.parts[0].meters = 1500
        const lines = [west, south]
        expect(adoptAlongStraight(lines, usesOfLines(lines))).toBe(0)
    })
})

describe('HIDDEN_WAY_IDS (ручное исключение)', () => {
    it('скрытый way не попадает в сегменты, отсутствующий в ответе — в сводку', () => {
        const [hidden] = HIDDEN_WAY_IDS
        const { segments, stats } = buildSegments([
            osmWay(hidden, { highway: 'cycleway' }, [
                [76.88, 43.18],
                [76.88, 43.19],
            ]),
            osmWay(1, { highway: 'cycleway', name: 'Аллея' }, [
                [76.9, 43.24],
                [76.9, 43.241],
            ]),
        ])
        expect(segments.map((s) => s.id)).toEqual([1])
        expect(stats.hiddenMissing).toEqual([...HIDDEN_WAY_IDS].filter((id) => id !== hidden))
    })
})

describe('buildSegments — объезд не мешает склейке', () => {
    it('петля с концами на стыках не создаёт ложных развилок (Сейфуллина)', () => {
        const tags = { highway: 'cycleway', name: 'проспект Сейфуллина' }
        const { segments } = buildSegments([
            osmWay(1, tags, [
                [76.9, 43.24],
                [76.9, 43.241],
            ]),
            osmWay(2, tags, [
                [76.9, 43.241],
                [76.9, 43.2415],
            ]),
            // Объезд между теми же точками, что и кусок 2, в ~5 м сбоку
            osmWay(3, tags, [
                [76.9, 43.241],
                [76.90006, 43.24125],
                [76.9, 43.2415],
            ]),
            osmWay(4, tags, [
                [76.9, 43.2415],
                [76.9, 43.243],
            ]),
        ])
        expect(segments).toHaveLength(1)
        expect(segments[0].id).toBe(1)
    })
})

describe('applyMergeGroups (ручные склейки)', () => {
    const way = (id, coordinates, laneType = 'separated') => ({ id, coordinates, tags: {}, lane: { laneType } })

    it('склеивает куски по порядку, разворачивая их к хвосту цепочки', () => {
        const ways = [
            // въезд нарисован от петли наружу — должен развернуться
            way(30, [
                [76.9, 43.241],
                [76.899, 43.2415],
            ]),
            way(20, [
                [76.9, 43.241],
                [76.9, 43.24],
            ]),
            way(10, [
                [76.9005, 43.24],
                [76.9005, 43.241],
            ]),
            way(99, [
                [77.0, 43.3],
                [77.0, 43.31],
            ]),
        ]
        const { ways: result, warnings } = applyMergeGroups(ways, [[30, 20, 10]])
        expect(warnings).toEqual([])
        expect(result.map((w) => w.id).sort()).toEqual([10, 99])
        const merged = result.find((w) => w.id === 10)
        expect(merged.coordinates).toEqual([
            [76.899, 43.2415],
            [76.9, 43.241],
            [76.9, 43.24],
            [76.9005, 43.24],
            [76.9005, 43.241],
        ])
    })

    it('предупреждает о пропавшем id и о большом разрыве', () => {
        const ways = [
            way(1, [
                [76.9, 43.24],
                [76.9, 43.241],
            ]),
            way(2, [
                [76.9, 43.25],
                [76.9, 43.26],
            ]),
        ]
        const { warnings } = applyMergeGroups(ways, [[1, 2, 3]])
        expect(warnings).toHaveLength(2)
        expect(warnings[0]).toContain('нет среди велодорожек')
        expect(warnings[1]).toContain('разрыв')
    })
})

describe('buildSegments — огрызки', () => {
    it('выбрасывает итоговую линию короче 20 м (Байсеитовой)', () => {
        const { segments, stats } = buildSegments([
            osmWay(1, { highway: 'residential', name: 'улица Байсеитовой', 'cycleway:both': 'shoulder' }, [
                [76.9, 43.24],
                [76.9, 43.24005],
            ]),
            osmWay(2, { highway: 'cycleway', name: 'Аллея' }, [
                [76.95, 43.24],
                [76.95, 43.241],
            ]),
        ])
        expect(segments.map((s) => s.id)).toEqual([2])
        expect(stats.short).toBe(1)
    })
})

describe('adoptAlongStraight — завершается', () => {
    it('короткая линия между двумя сильными соседями не перебрасывается бесконечно', () => {
        // N1 «x» 320 м — L «z» 80 м — N2 «y» 320 м, всё по прямой, названия подобраны
        const make = (name, meters, coordinates) => ({
            ids: [1],
            key: name,
            parts: [{ laneType: 'separated', name, rank: 1, meters }],
            coordinates,
            startNode: coordinates[0].join(),
            endNode: coordinates[coordinates.length - 1].join(),
        })
        const P = [76.9, 43.24]
        const Q = [76.9, 43.2407]
        const lines = [
            make('x', 320, [[76.9, 43.2371], P]),
            make('z', 80, [P, Q]),
            make('y', 320, [Q, [76.9, 43.2436]]),
        ]
        const uses = new Map()
        for (const l of lines) for (const n of [l.startNode, l.endNode]) uses.set(n, (uses.get(n) ?? 0) + 1)
        const adopted = adoptAlongStraight(lines, uses)
        expect(adopted).toBeGreaterThan(0)
        expect(['x', 'y']).toContain(lines[1].key)
    })
})

describe('applyMergeGroups — повторы id', () => {
    it('повтор id в группе и между группами — предупреждение без дублей геометрии', () => {
        const way = (id, coordinates) => ({ id, coordinates, tags: {}, lane: { laneType: 'separated' } })
        const ways = [
            way(1, [
                [76.9, 43.24],
                [76.9, 43.241],
            ]),
            way(2, [
                [76.9, 43.241],
                [76.9, 43.242],
            ]),
            way(3, [
                [76.9, 43.242],
                [76.9, 43.243],
            ]),
        ]
        const { ways: result, warnings } = applyMergeGroups(ways, [
            [1, 2, 2],
            [2, 3],
        ])
        expect(warnings.some((w) => w.includes('повторяется'))).toBe(true)
        const ids = result.map((w) => w.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(result.find((w) => w.id === 1).coordinates).toHaveLength(3)
    })
})
