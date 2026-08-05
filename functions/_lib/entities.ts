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

const bikeLanes = bikeLanesData as VelojolSegment[]

interface PointRow {
    title?: string
    description?: string | null
    type?: string
    map_point_photos?: { bucket_name?: string; storage_path?: string; sort_order?: number }[]
}

interface RouteRow {
    title?: string
    description?: string | null
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

/**
 * Данные сущности для метатегов. Точки и маршруты читаются из Supabase
 * (RLS сам отсекает скрытые), велодорожки — из статического датасета velojol.
 * Для райдеров (`telegramUser`) метатеги не строим: это персональные данные.
 */
export async function resolveEntity(type: string, id: string, env: OgEnv): Promise<MapEntity | null> {
    if (type === 'point' || type === 'socket') {
        const select = 'title,description,type,map_point_photos(bucket_name,storage_path,sort_order)'
        const rows = await fetchFromSupabase<PointRow[]>(
            env,
            `map_points?id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`,
        )
        const row = rows?.[0]
        if (!row?.title) return null
        return {
            // Тип берём из БД: /m/point/… и /m/socket/… ведут в одну таблицу,
            // и розетка, открытая по ссылке на точку, должна остаться розеткой.
            type: row.type === 'socket' ? 'socket' : 'point',
            name: row.title,
            description: row.description,
            image: env.SUPABASE_URL ? firstPhotoUrl(env.SUPABASE_URL, row) : null,
        }
    }

    if (type === 'route') {
        const rows = await fetchFromSupabase<RouteRow[]>(
            env,
            `map_routes?id=eq.${encodeURIComponent(id)}&select=title,description&limit=1`,
        )
        const row = rows?.[0]
        if (!row?.title) return null
        return { type: 'route', name: row.title, description: row.description }
    }

    if (type === 'bikeLane') {
        const lane = bikeLanes.find((segment) => String(segment.id) === id)
        if (!lane) return null
        const details = [lane.laneTypeLabel, `${String(lane.distance)} км`]
        if (lane.qualityLabel) details.push(`покрытие: ${lane.qualityLabel.toLowerCase()}`)
        return { type: 'bikeLane', name: lane.name, description: lane.description, details }
    }

    return null
}
