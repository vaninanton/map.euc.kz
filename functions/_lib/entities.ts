import type { VelojolSegment } from '../../src/types/velojol'
import bikeLanesData from '../../src/data/almaty.json'
import { storagePublicUrl, type MapEntity } from './ogMeta'

/** Переменные окружения Pages-проекта (задаются в дашборде Cloudflare). */
export interface OgEnv {
    SUPABASE_URL?: string
    SUPABASE_ANON_KEY?: string
}

/**
 * Запрос к Supabase не должен задерживать отдачу страницы живому пользователю:
 * не уложились — отдаём разметку с дефолтными метатегами.
 */
const FETCH_TIMEOUT_MS = 2500

/**
 * Сколько держать в edge-кэше дамп точек и маршрутов. Дамп целиком — 23 КБ на
 * 65 точек и 43 маршрута, поэтому дешевле забрать всё разом: краулер приходит по
 * свежепошаренной ссылке, которую в этом дата-центре ещё не запрашивали, и при
 * покомпонентном кэше это всегда промах.
 *
 * Кэшируем данные, а не готовый HTML: разметка всегда берётся из свежего деплоя,
 * иначе после выката страница сослалась бы на удалённые бандлы.
 */
const DATASET_CACHE_TTL_SECONDS = 3600

/** Промахи кэшируем отдельно и коротко: сущность могли добавить только что. */
const MISS_CACHE_TTL_SECONDS = 300

const CACHE_ORIGIN = 'https://og-cache.map.euc.kz'

const bikeLanes = bikeLanesData as VelojolSegment[]

interface PointRow {
    id?: number | string
    title?: string
    description?: string | null
    type?: string
    coordinates?: unknown
    map_point_photos?: { bucket_name?: string; storage_path?: string; sort_order?: number }[]
}

interface RouteRow {
    id?: number | string
    title?: string
    description?: string | null
}

/** Дамп сущностей из БД, разложенный по id. */
interface Dataset {
    points: Record<string, MapEntity>
    routes: Record<string, MapEntity>
}

const POINT_SELECT = 'id,title,description,type,coordinates,map_point_photos(bucket_name,storage_path,sort_order)'
const ROUTE_SELECT = 'id,title,description'

/** Координаты точки из БД хранятся как [lon, lat]. */
function asCoordinates(value: unknown): { lon: number; lat: number } | null {
    if (!Array.isArray(value) || value.length < 2) return null
    const [lon, lat] = value as unknown[]
    if (typeof lon !== 'number' || typeof lat !== 'number') return null
    return { lon, lat }
}

async function fetchFromSupabase<T>(env: OgEnv, path: string): Promise<T | null> {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
    try {
        const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
            headers: {
                apikey: env.SUPABASE_ANON_KEY,
                authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
                accept: 'application/json',
            },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        if (!response.ok) return null
        return await response.json<T>()
    } catch {
        // Таймаут, сеть, битый JSON — метатеги не тот случай, ради которого стоит ронять страницу.
        return null
    }
}

/** Первое фото точки по sort_order — оно же главное в карточке на сайте. */
function firstPhotoUrl(supabaseUrl: string, row: PointRow): string | null {
    const photos = [...(row.map_point_photos ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const photo = photos.find((item) => item.bucket_name && item.storage_path)
    if (!photo?.bucket_name || !photo.storage_path) return null
    return storagePublicUrl(supabaseUrl, photo.bucket_name, photo.storage_path)
}

function pointEntity(row: PointRow, supabaseUrl: string | undefined): MapEntity | null {
    if (!row.title) return null
    return {
        // Тип берём из БД: /m/point/… и /m/socket/… ведут в одну таблицу,
        // и розетка, открытая по ссылке на точку, должна остаться розеткой.
        type: row.type === 'socket' ? 'socket' : 'point',
        name: row.title,
        description: row.description,
        image: supabaseUrl ? firstPhotoUrl(supabaseUrl, row) : null,
        geo: asCoordinates(row.coordinates),
    }
}

function routeEntity(row: RouteRow): MapEntity | null {
    if (!row.title) return null
    return { type: 'route', name: row.title, description: row.description }
}

function bikeLaneEntity(id: string): MapEntity | null {
    const lane = bikeLanes.find((segment) => String(segment.id) === id)
    if (!lane) return null
    const details = [lane.laneTypeLabel, `${String(lane.distance)} км`]
    if (lane.qualityLabel) details.push(`покрытие: ${lane.qualityLabel.toLowerCase()}`)
    return { type: 'bikeLane', name: lane.name, description: lane.description, details }
}

/** Дамп точек и маршрутов одним заходом; null — если хоть одна половина не приехала. */
async function loadDataset(env: OgEnv): Promise<Dataset | null> {
    const [pointRows, routeRows] = await Promise.all([
        fetchFromSupabase<PointRow[]>(env, `map_points?select=${POINT_SELECT}`),
        fetchFromSupabase<RouteRow[]>(env, `map_routes?select=${ROUTE_SELECT}`),
    ])
    // Половинчатый дамп не кэшируем: час отдавать пустую мету хуже, чем сходить ещё раз.
    if (!pointRows || !routeRows) return null

    const dataset: Dataset = { points: {}, routes: {} }
    for (const row of pointRows) {
        const entity = pointEntity(row, env.SUPABASE_URL)
        if (entity && row.id !== undefined) dataset.points[String(row.id)] = entity
    }
    for (const row of routeRows) {
        const entity = routeEntity(row)
        if (entity && row.id !== undefined) dataset.routes[String(row.id)] = entity
    }
    return dataset
}

async function getDataset(env: OgEnv, waitUntil: (promise: Promise<unknown>) => void): Promise<Dataset | null> {
    // Ключ — синтетический URL: Cache API принимает только http(s)-адреса.
    const cacheKey = new Request(`${CACHE_ORIGIN}/dataset/v1`)
    const cache = caches.default

    const hit = await cache.match(cacheKey)
    if (hit) return await hit.json<Dataset>()

    const dataset = await loadDataset(env)
    if (!dataset) return null

    const cached = new Response(JSON.stringify(dataset), {
        headers: {
            'content-type': 'application/json',
            'cache-control': `public, max-age=${String(DATASET_CACHE_TTL_SECONDS)}`,
        },
    })
    waitUntil(cache.put(cacheKey, cached))
    return dataset
}

/**
 * Пути всех сущностей для карты сайта: точки и маршруты из того же часового
 * дампа, велодорожки из вшитого датасета, события — отдельным запросом
 * (в дампе для метатегов они не нужны, у событий своя страница /events/:id).
 */
export async function listSitemapEntries(
    env: OgEnv,
    waitUntil: (promise: Promise<unknown>) => void,
): Promise<string[]> {
    const [dataset, events] = await Promise.all([
        getDataset(env, waitUntil),
        fetchFromSupabase<{ id?: number | string }[]>(env, 'map_events?select=id'),
    ])

    const paths: string[] = []
    for (const [id, entity] of Object.entries(dataset?.points ?? {})) {
        paths.push(`/m/${entity.type === 'socket' ? 'socket' : 'point'}/${id}`)
    }
    for (const id of Object.keys(dataset?.routes ?? {})) paths.push(`/m/route/${id}`)
    for (const lane of bikeLanes) paths.push(`/m/bikelane/${String(lane.id)}`)
    for (const event of events ?? []) {
        if (event.id !== undefined) paths.push(`/events/${String(event.id)}`)
    }
    return paths
}

/**
 * Точечный запрос — фолбэк для сущности, которой нет в дампе: её могли создать
 * уже после того, как дамп попал в кэш. Промах кэшируется на 5 минут, иначе
 * перебор случайных id ботами бил бы в Supabase на каждый запрос.
 */
async function resolveMissed(type: string, id: string, env: OgEnv): Promise<MapEntity | null> {
    if (type === 'point' || type === 'socket') {
        const rows = await fetchFromSupabase<PointRow[]>(
            env,
            `map_points?id=eq.${encodeURIComponent(id)}&select=${POINT_SELECT}&limit=1`,
        )
        return rows?.[0] ? pointEntity(rows[0], env.SUPABASE_URL) : null
    }
    if (type === 'route') {
        const rows = await fetchFromSupabase<RouteRow[]>(
            env,
            `map_routes?id=eq.${encodeURIComponent(id)}&select=${ROUTE_SELECT}&limit=1`,
        )
        return rows?.[0] ? routeEntity(rows[0]) : null
    }
    return null
}

/**
 * Данные сущности для метатегов. Точки и маршруты — из часового дампа Supabase
 * (RLS сам отсекает скрытые), велодорожки — из статического датасета velojol,
 * вшитого в бандл. Для райдеров (`telegramUser`) метатеги не строим: это
 * персональные данные.
 */
export async function resolveEntity(
    type: string,
    id: string,
    env: OgEnv,
    waitUntil: (promise: Promise<unknown>) => void,
): Promise<MapEntity | null> {
    if (type === 'bikeLane') return bikeLaneEntity(id)
    if (type !== 'point' && type !== 'socket' && type !== 'route') return null

    const dataset = await getDataset(env, waitUntil)
    const fromDataset = type === 'route' ? dataset?.routes[id] : dataset?.points[id]
    if (fromDataset) return fromDataset

    const missKey = new Request(`${CACHE_ORIGIN}/miss/${type}/${encodeURIComponent(id)}`)
    const cache = caches.default
    const hit = await cache.match(missKey)
    if (hit) return await hit.json<MapEntity | null>()

    const entity = await resolveMissed(type, id, env)
    const cached = new Response(JSON.stringify(entity), {
        headers: {
            'content-type': 'application/json',
            'cache-control': `public, max-age=${String(MISS_CACHE_TTL_SECONDS)}`,
        },
    })
    waitUntil(cache.put(missKey, cached))
    return entity
}
