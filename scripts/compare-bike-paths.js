#!/usr/bin/env node
// Сверяет src/data/almaty.json с актуальными велодорожками из OpenStreetMap
// (через Overpass API) и печатает отчёт о расхождениях — что делать с ними,
// решает человек/Claude руками, скрипт только находит подозрительные места.
//
// Почему не velojol.kz API напрямую: путь из комментария в src/types/velojol.ts
// (velojol.kz/static/data/cities/almaty.json) на 2026-07-29 отдаёт 404 — сайт
// жив, но эндпоинт с данными переехал/убран. OSM Overpass — единственный
// стабильно доступный независимый источник для сверки.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'almaty.json')

// Bbox городской черты Алматы с запасом (юг, запад, север, восток).
const BBOX = '43.14,76.80,43.36,77.10'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  way["highway"="cycleway"](${BBOX});
  way["cycleway"]["cycleway"!="no"](${BBOX});
  way["cycleway:both"]["cycleway:both"!="no"](${BBOX});
  way["cycleway:left"]["cycleway:left"!="no"](${BBOX});
  way["cycleway:right"]["cycleway:right"!="no"](${BBOX});
);
out geom;
`

// Порог, за которым точка считается "далеко от ближайшей велодорожки OSM".
const STALE_THRESHOLD_M = 150
const NEW_CANDIDATE_THRESHOLD_M = 150

function haversineMeters([lon1, lat1], [lon2, lat2]) {
    const R = 6371000
    const toRad = (d) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
}

function minDistanceToPoints(point, points) {
    let min = Infinity
    for (const p of points) {
        const d = haversineMeters(point, p)
        if (d < min) min = d
    }
    return min
}

async function fetchOsmCycleways() {
    const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: '*/*',
            'User-Agent': 'map.euc.kz-bike-path-sync/1.0 (github.com/vaninanton/map.euc.kz)',
        },
        body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    })
    if (!res.ok) {
        throw new Error(`Overpass API ответил ${res.status}: ${await res.text()}`)
    }
    const data = await res.json()
    return data.elements
        .filter((el) => el.type === 'way' && el.geometry)
        .map((el) => ({
            id: el.id,
            tags: el.tags ?? {},
            coords: el.geometry.map((g) => [g.lon, g.lat]),
        }))
}

const JSON_MODE = process.argv.includes('--json')

async function main() {
    const current = JSON.parse(await readFile(DATA_PATH, 'utf-8'))
    console.error(`Текущих сегментов в almaty.json: ${current.length}`)
    console.error('Запрашиваю Overpass API...')

    const osmWays = await fetchOsmCycleways()
    console.error(`Найдено велодорожек в OSM (bbox Алматы): ${osmWays.length}`)

    const osmPoints = osmWays.flatMap((w) => w.coords)

    const stale = []
    for (const seg of current) {
        const first = seg.coordinates[0]
        const last = seg.coordinates[seg.coordinates.length - 1]
        const d = Math.min(minDistanceToPoints(first, osmPoints), minDistanceToPoints(last, osmPoints))
        if (d > STALE_THRESHOLD_M) {
            stale.push({ id: seg.id, name: seg.name, nearestOsmMeters: Math.round(d) })
        }
    }

    const candidates = []
    for (const way of osmWays) {
        const mid = way.coords[Math.floor(way.coords.length / 2)]
        const currentPoints = current.flatMap((s) => s.coordinates)
        const d = minDistanceToPoints(mid, currentPoints)
        if (d > NEW_CANDIDATE_THRESHOLD_M) {
            candidates.push({
                osmId: way.id,
                name: way.tags.name ?? '(без имени в OSM)',
                nearestCurrentMeters: Math.round(d),
                osmUrl: `https://www.openstreetmap.org/way/${way.id}`,
            })
        }
    }

    if (JSON_MODE) {
        console.log(JSON.stringify({ stale, candidates }, null, 2))
        return
    }

    console.log('\n=== Возможно устаревшие сегменты в almaty.json ===')
    console.log(
        '(концы сегмента дальше ' +
            STALE_THRESHOLD_M +
            ' м от любой велодорожки OSM — проверить руками, могли снести/переименовать)',
    )
    if (stale.length === 0) {
        console.log('Нет — все текущие сегменты рядом с чем-то в OSM.')
    } else {
        for (const s of stale) {
            console.log(`  ${s.id}  "${s.name}"  — ближайшая OSM-дорожка в ${s.nearestOsmMeters} м`)
        }
    }

    console.log('\n=== Кандидаты на добавление (есть в OSM, нет в almaty.json) ===')
    console.log(
        '(велодорожка OSM дальше ' +
            NEW_CANDIDATE_THRESHOLD_M +
            ' м от любого текущего сегмента; ' +
            'сгруппировано по имени — OSM режет одну улицу на много ways)',
    )
    if (candidates.length === 0) {
        console.log('Нет — все велодорожки OSM уже рядом с существующими сегментами.')
    } else {
        const byName = new Map()
        for (const c of candidates) {
            if (!byName.has(c.name)) byName.set(c.name, [])
            byName.get(c.name).push(c)
        }
        const sorted = [...byName.entries()].sort((a, b) => b[1].length - a[1].length)
        for (const [name, group] of sorted) {
            console.log(`  "${name}" — фрагментов: ${group.length}, пример: ${group[0].osmUrl}`)
        }
        console.log(`  (всего уникальных названий: ${byName.size})`)
    }

    console.log(
        `\nИтого: ${stale.length} на проверку устаревания, ${candidates.length} фрагментов / кандидатов на добавление.`,
    )
    console.log('JSON с полными данными (для дальнейшей автоматической обработки): добавь флаг --json')
    console.log(
        'Это черновой геометрический скрининг, не автообновление — safetyLevel/description/source у сегментов данные ручные, их OSM не знает.',
    )
}

main().catch((err) => {
    console.error('Ошибка:', err.message)
    process.exit(1)
})
