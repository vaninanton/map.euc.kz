#!/usr/bin/env node
// Полный пересбор src/data/almaty.json из OpenStreetMap. OSM — источник
// истины (см. .claude/skills/update-bike-paths/SKILL.md): velojol.kz API
// (упомянутый в src/types/velojol.ts) 404 с 2026-07-29, а ручная сверка
// "OSM подсказывает, человек проверяет" на практике оказалась ненадёжной —
// см. историю PR #176/#177/#179 в этом же скилле.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'almaty.json')

const BBOX = '43.14,76.80,43.36,77.10'
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter']
const OVERPASS_QUERY = `
[out:json][timeout:90];
(
  way["highway"="cycleway"](${BBOX});
  way["cycleway"]["cycleway"!="no"](${BBOX});
  way["cycleway:both"]["cycleway:both"!="no"](${BBOX});
  way["cycleway:left"]["cycleway:left"!="no"](${BBOX});
  way["cycleway:right"]["cycleway:right"!="no"](${BBOX});
);
out geom;
`

// Явный шум: сети MTB-трасс, которые попадают в выборку по cycleway-тегам,
// но не являются городской велодорожкой.
const EXCLUDE_NAME_SUBSTR = ['XCO']

// OSM-контрибьюторы иногда расходятся в написании name:ru для одной и той
// же улицы (напр. полное отчество/имя vs короткая форма). Обнаруженные
// случаи — сюда, по мере находок.
const NAME_ALIASES = {
    'улица Каныша Сатпаева': 'улица Сатпаева',
}

const TOLERANCE_M = 60 // макс. разрыв между концами фрагментов для сшивки в цепочку
const MIN_LENGTH_M = 30 // короче — считаем шумом (пешеходный переход и т.п.)

function haversineMeters([lon1, lat1], [lon2, lat2]) {
    const R = 6371000
    const toRad = (d) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
}

function pathLength(coords) {
    let total = 0
    for (let i = 0; i < coords.length - 1; i++) total += haversineMeters(coords[i], coords[i + 1])
    return total
}

// Жадная сшивка фрагментов одной улицы в непрерывные цепочки по близости
// концов. Не топологический солвер — если между двумя реальными кусками
// разрыв больше TOLERANCE_M, получится две отдельные цепочки (это нормально,
// на длинных улицах в OSM бывают физические разрывы велодорожки).
// fragments: [{ tag, coords }]. Возвращает [{ tag, coords }] — tag взят от
// первого фрагмента, вошедшего в цепочку (нужен для fallback-имени
// безымянных сегментов).
function chainFragments(fragments) {
    const frags = fragments.map((f) => ({ tag: f.tag, coords: [...f.coords] }))
    const used = new Array(frags.length).fill(false)
    const chains = []
    for (let i = 0; i < frags.length; i++) {
        if (used[i]) continue
        used[i] = true
        const tag = frags[i].tag
        let chain = [...frags[i].coords]
        let extended = true
        while (extended) {
            extended = false
            for (let j = 0; j < frags.length; j++) {
                if (used[j]) continue
                const f = frags[j].coords
                if (haversineMeters(chain[chain.length - 1], f[0]) < TOLERANCE_M) {
                    chain = chain.concat(f.slice(1))
                    used[j] = true
                    extended = true
                } else if (haversineMeters(chain[chain.length - 1], f[f.length - 1]) < TOLERANCE_M) {
                    chain = chain.concat([...f].reverse().slice(1))
                    used[j] = true
                    extended = true
                } else if (haversineMeters(chain[0], f[f.length - 1]) < TOLERANCE_M) {
                    chain = f.slice(0, -1).concat(chain)
                    used[j] = true
                    extended = true
                } else if (haversineMeters(chain[0], f[0]) < TOLERANCE_M) {
                    chain = [...f].reverse().slice(0, -1).concat(chain)
                    used[j] = true
                    extended = true
                }
            }
        }
        chains.push({ tag, coords: chain })
    }
    return chains
}

async function fetchOsmCycleways() {
    let lastError
    for (const url of OVERPASS_URLS) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: '*/*',
                    // Без явного User-Agent Overpass иногда отвечает 406 Not Acceptable —
                    // не полагайся на дефолтные заголовки fetch.
                    'User-Agent': 'map.euc.kz-bike-path-sync/1.0 (github.com/vaninanton/map.euc.kz)',
                },
                body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
            })
            if (!res.ok) throw new Error(`${url} ответил ${res.status}: ${(await res.text()).slice(0, 300)}`)
            return (await res.json()).elements.filter((el) => el.type === 'way' && el.geometry)
        } catch (err) {
            console.error(`  ${url} — ${err.message}`)
            lastError = err
        }
    }
    throw new Error(`Все зеркала Overpass недоступны: ${lastError?.message}`)
}

// Собственный сериализатор вместо JSON.stringify(data, null, 2): у файла
// координатные пары [lon, lat] всегда в одну строку. Generic stringify с
// отступом разворачивает КАЖДОЕ число на отдельную строку и превращает
// любую правку в диф на тысячи строк по всему файлу (наступали на эти
// грабли в PR #176 — правили потом руками).
function serialize(segments) {
    const renderSegment = (seg) => {
        const parts = Object.entries(seg).map(([key, value]) => {
            if (key === 'coordinates') {
                const lines = value.map(([lon, lat]) => `      [${lon}, ${lat}]`)
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
    const ways = await fetchOsmCycleways()
    console.error(`Получено way: ${ways.length}`)

    const byName = new Map()
    const unnamed = []
    let skippedNoise = 0

    for (const way of ways) {
        const tags = way.tags ?? {}
        const rawName = tags.name
        const coords = way.geometry.map((g) => [g.lon, g.lat])
        if (!rawName) {
            unnamed.push({ wayId: way.id, coords })
            continue
        }
        if (EXCLUDE_NAME_SUBSTR.some((x) => rawName.includes(x))) {
            skippedNoise++
            continue
        }
        let displayName = tags['name:ru'] ?? rawName
        displayName = NAME_ALIASES[displayName] ?? displayName
        if (!byName.has(displayName)) byName.set(displayName, [])
        byName.get(displayName).push({ tag: way.id, coords })
    }

    const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('.').slice(0, 8)
    const segments = []
    let nextId = 1

    for (const name of [...byName.keys()].sort()) {
        for (const { coords: chain } of chainFragments(byName.get(name))) {
            const distance = pathLength(chain)
            if (distance < MIN_LENGTH_M) continue
            segments.push({
                id: `alm${nextId++}`,
                name,
                distance: Math.round(distance * 100) / 100,
                description: `Загружено из OpenStreetMap (${today}).`,
                coordinates: chain,
                source: 'OSM',
                date: today,
            })
        }
    }

    let unnamedAdded = 0
    const unnamedFragments = unnamed.map((u) => ({ tag: u.wayId, coords: u.coords }))
    for (const { tag: firstWayId, coords: chain } of chainFragments(unnamedFragments)) {
        const distance = pathLength(chain)
        if (distance < MIN_LENGTH_M) continue
        // Имя первого сшитого фрагмента — устойчивый идентификатор для ссылки
        // на конкретный объект OSM, раз человекочитаемого имени нет.
        segments.push({
            id: `alm${nextId++}`,
            name: `Велодорожка (OSM way ${firstWayId})`,
            distance: Math.round(distance * 100) / 100,
            description: `Загружено из OpenStreetMap (${today}). Название улицы в OSM не указано.`,
            coordinates: chain,
            source: 'OSM',
            date: today,
        })
        unnamedAdded++
    }

    await writeFile(OUT_PATH, serialize(segments))

    console.log(
        `Сегментов: ${segments.length} (именованных: ${segments.length - unnamedAdded}, безымянных: ${unnamedAdded})`,
    )
    console.log(`Суммарная длина: ${(segments.reduce((s, seg) => s + seg.distance, 0) / 1000).toFixed(1)} км`)
    console.log(`Пропущено как шум (MTB-трассы): ${skippedNoise}`)
    console.log('\nЭто полная замена файла — прогони lint/format/tsc/build/test:e2e перед коммитом.')
}

main().catch((err) => {
    console.error('Ошибка:', err.message)
    process.exit(1)
})
