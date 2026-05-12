import type { MapPointType } from '@/types'
import { isRecord } from '@/utils/mapFeatureGuards'
import type { AdminMapPoint, AdminMapRoute, AdminSubmission, SubmissionStatus } from '@/admin/lib/adminApi/types'

function isMapPointType(value: unknown): value is MapPointType {
    return value === 'point' || value === 'socket'
}

function isSubmissionStatus(value: unknown): value is SubmissionStatus {
    return value === 'pending' || value === 'approved' || value === 'rejected'
}

function asCoordinatePair(value: unknown): [number, number] {
    if (!Array.isArray(value) || value.length < 2) {
        throw new Error('coordinates не массив')
    }
    const lng = Number(value[0])
    const lat = Number(value[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error('coordinates не числа')
    }
    return [lng, lat]
}

function asCoordinatePairList(value: unknown): [number, number][] {
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) {
        throw new Error('via_coordinates не массив')
    }
    return value.map((point) => asCoordinatePair(point))
}

function asRouteCoordinates(value: unknown): AdminMapRoute['coordinates'] {
    if (!Array.isArray(value) || value.length < 2) {
        throw new Error('coordinates маршрута должны быть массивом минимум из 2 точек')
    }
    const out: AdminMapRoute['coordinates'] = []
    for (const pt of value) {
        if (!Array.isArray(pt) || pt.length < 2) {
            throw new Error('вершина маршрута некорректна')
        }
        const lng = Number(pt[0])
        const lat = Number(pt[1])
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            throw new Error('вершина маршрута не числа')
        }
        if (pt.length >= 3) {
            const z = Number(pt[2])
            if (!Number.isFinite(z)) throw new Error('высота вершины некорректна')
            out.push([lng, lat, z])
        } else {
            out.push([lng, lat])
        }
    }
    return out
}

/**
 * Валидирует и нормализует строку `map_points` в доменную модель админки.
 */
export function parseAdminMapPoint(raw: unknown): AdminMapPoint {
    if (!isRecord(raw)) throw new Error('не объект')
    const id = raw.id
    const created_at = raw.created_at
    const type = raw.type
    const title = raw.title
    const description = raw.description
    const coordinates = raw.coordinates
    const flag_is_meeting = raw.flag_is_meeting
    const flag_has_socket = raw.flag_has_socket
    const flag_erlan = raw.flag_erlan
    const flag_disabled = raw.flag_disabled

    if (typeof id !== 'number' || !Number.isFinite(id)) throw new Error('id')
    if (typeof created_at !== 'string') throw new Error('created_at')
    if (!isMapPointType(type)) throw new Error('type')
    if (typeof title !== 'string') throw new Error('title')
    if (description !== undefined && description !== null && typeof description !== 'string') {
        throw new Error('description')
    }
    if (typeof flag_is_meeting !== 'boolean') throw new Error('flag_is_meeting')
    if (typeof flag_has_socket !== 'boolean') throw new Error('flag_has_socket')
    if (typeof flag_erlan !== 'boolean') throw new Error('flag_erlan')
    if (typeof flag_disabled !== 'boolean') throw new Error('flag_disabled')

    const descriptionNorm: string | null =
        description === undefined || description === null ? null : description

    return {
        id,
        created_at,
        type,
        title,
        description: descriptionNorm,
        coordinates: asCoordinatePair(coordinates),
        flag_is_meeting,
        flag_has_socket,
        flag_erlan,
        flag_disabled,
    }
}

/**
 * Валидирует и нормализует строку `map_routes` в доменную модель маршрута.
 */
export function parseAdminMapRoute(raw: unknown): AdminMapRoute {
    if (!isRecord(raw)) throw new Error('не объект')
    const id = raw.id
    const created_at = raw.created_at
    const title = raw.title
    const description = raw.description
    const coordinates = raw.coordinates
    const via_coordinates = raw.via_coordinates
    const flag_erlan = raw.flag_erlan
    const flag_disabled = raw.flag_disabled

    if (typeof id !== 'number' || !Number.isFinite(id)) throw new Error('id')
    if (typeof created_at !== 'string') throw new Error('created_at')
    if (typeof title !== 'string') throw new Error('title')
    if (description !== undefined && description !== null && typeof description !== 'string') {
        throw new Error('description')
    }
    if (typeof flag_erlan !== 'boolean') throw new Error('flag_erlan')
    if (typeof flag_disabled !== 'boolean') throw new Error('flag_disabled')

    const descriptionNorm: string | null =
        description === undefined || description === null ? null : description

    return {
        id,
        created_at,
        title,
        description: descriptionNorm,
        coordinates: asRouteCoordinates(coordinates),
        via_coordinates: asCoordinatePairList(via_coordinates),
        flag_erlan,
        flag_disabled,
    }
}

/**
 * Валидирует и нормализует строку из `map_points_submissions`.
 */
export function parseAdminSubmission(raw: unknown): AdminSubmission {
    if (!isRecord(raw)) throw new Error('не объект')
    const id = raw.id
    const created_at = raw.created_at
    const processed_at = raw.processed_at
    const type = raw.type
    const title = raw.title
    const description = raw.description
    const coordinates = raw.coordinates
    const flag_is_meeting = raw.flag_is_meeting
    const status = raw.status

    if (typeof id !== 'string') throw new Error('id')
    if (typeof created_at !== 'string') throw new Error('created_at')
    if (processed_at !== null && typeof processed_at !== 'string') throw new Error('processed_at')
    if (!isMapPointType(type)) throw new Error('type')
    if (typeof title !== 'string') throw new Error('title')
    if (description !== undefined && description !== null && typeof description !== 'string') {
        throw new Error('description')
    }
    if (typeof flag_is_meeting !== 'boolean') throw new Error('flag_is_meeting')
    if (!isSubmissionStatus(status)) throw new Error('status')

    const descriptionNorm: string | null =
        description === undefined || description === null ? null : description

    return {
        id,
        created_at,
        processed_at,
        type,
        title,
        description: descriptionNorm,
        coordinates: asCoordinatePair(coordinates),
        flag_is_meeting,
        status,
    }
}

export interface PhotoRowDB {
    id: string
    created_at: string
    point_id: number
    bucket_name: string
    storage_path: string
    alt_text: string | null
    sort_order: number
}

/**
 * Валидирует строку `map_point_photos` из Supabase перед добавлением `public_url`.
 */
export function parsePhotoRowDB(raw: unknown): PhotoRowDB {
    if (!isRecord(raw)) throw new Error('не объект')
    const id = raw.id
    const created_at = raw.created_at
    const point_id = raw.point_id
    const bucket_name = raw.bucket_name
    const storage_path = raw.storage_path
    const alt_text = raw.alt_text
    const sort_order = raw.sort_order

    if (typeof id !== 'string') throw new Error('id')
    if (typeof created_at !== 'string') throw new Error('created_at')
    if (typeof point_id !== 'number' || !Number.isFinite(point_id)) throw new Error('point_id')
    if (typeof bucket_name !== 'string') throw new Error('bucket_name')
    if (typeof storage_path !== 'string') throw new Error('storage_path')
    if (alt_text !== null && typeof alt_text !== 'string') throw new Error('alt_text')
    if (typeof sort_order !== 'number' || !Number.isFinite(sort_order)) throw new Error('sort_order')

    return {
        id,
        created_at,
        point_id,
        bucket_name,
        storage_path,
        alt_text,
        sort_order,
    }
}
