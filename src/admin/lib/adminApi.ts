import type { PostgrestError } from '@supabase/supabase-js'
import type { MapPointType } from '@/types'
import { requireSupabase } from '@/lib/supabase'

const PHOTOS_BUCKET = 'map-point-photos'

/** Клиент с сессией пользователя (RLS). */
function db() {
    return requireSupabase()
}

export interface AdminMapPoint {
    id: number
    created_at: string
    type: MapPointType
    title: string
    description: string | null
    coordinates: [number, number]
    flag_is_meeting: boolean
    flag_has_socket: boolean
    flag_disabled: boolean
}

export interface AdminMapRoute {
    id: number
    created_at: string
    title: string
    description: string | null
    coordinates: Array<[number, number] | [number, number, number]>
    flag_disabled: boolean
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface AdminSubmission {
    id: string
    created_at: string
    processed_at: string | null
    type: MapPointType
    title: string
    description: string | null
    coordinates: [number, number]
    flag_is_meeting: boolean
    status: SubmissionStatus
}

export interface AdminPhoto {
    id: string
    created_at: string
    point_id: number
    bucket_name: string
    storage_path: string
    alt_text: string | null
    sort_order: number
    public_url: string
}

export interface MapPointInput {
    type: MapPointType
    title: string
    description: string | null
    coordinates: [number, number]
    flag_is_meeting: boolean
    flag_has_socket: boolean
    flag_disabled: boolean
}

export interface MapRouteInput {
    title: string
    description: string | null
    coordinates: Array<[number, number] | [number, number, number]>
    flag_disabled: boolean
}

interface QueryResult<T> {
    data: T | null
    error: PostgrestError | null
}

async function runOne<T>(
    label: string,
    promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>,
): Promise<T> {
    const result = (await promise) as QueryResult<T>
    if (result.error) {
        console.error(`${label}:`, result.error)
        throw new Error(result.error.message)
    }
    if (result.data === null) {
        throw new Error(`${label}: пустой ответ`)
    }
    return result.data
}

async function runMany<T>(
    label: string,
    promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>,
): Promise<T[]> {
    const result = (await promise) as QueryResult<T[]>
    if (result.error) {
        console.error(`${label}:`, result.error)
        throw new Error(result.error.message)
    }
    return result.data ?? []
}

function publicUrl(storagePath: string): string {
    return db().storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

// ===== Points =====

export async function listPoints(): Promise<AdminMapPoint[]> {
    return runMany<AdminMapPoint>(
        'listPoints',
        db().from('map_points').select('*').order('title', { ascending: true }),
    )
}

export async function getPoint(id: number): Promise<AdminMapPoint> {
    return runOne<AdminMapPoint>(
        'getPoint',
        db().from('map_points').select('*').eq('id', id).single(),
    )
}

export async function createPoint(input: MapPointInput): Promise<AdminMapPoint> {
    return runOne<AdminMapPoint>(
        'createPoint',
        db().from('map_points').insert(input).select('*').single(),
    )
}

export async function updatePoint(id: number, input: Partial<MapPointInput>): Promise<AdminMapPoint> {
    return runOne<AdminMapPoint>(
        'updatePoint',
        db().from('map_points').update(input).eq('id', id).select('*').single(),
    )
}

export async function togglePointDisabled(id: number, disabled: boolean): Promise<void> {
    const { error } = await db().from('map_points').update({ flag_disabled: disabled }).eq('id', id)
    if (error) {
        console.error('togglePointDisabled:', error)
        throw new Error(error.message)
    }
}

export async function deletePoint(id: number): Promise<void> {
    const photos = await listPhotos(id)
    if (photos.length > 0) {
        await db().storage.from(PHOTOS_BUCKET).remove(photos.map((photo) => photo.storage_path))
    }
    const { error } = await db().from('map_points').delete().eq('id', id)
    if (error) {
        console.error('deletePoint:', error)
        throw new Error(error.message)
    }
}

// ===== Routes =====

export async function listRoutes(): Promise<AdminMapRoute[]> {
    return runMany<AdminMapRoute>(
        'listRoutes',
        db().from('map_routes').select('*').order('title', { ascending: true }),
    )
}

export async function getRoute(id: number): Promise<AdminMapRoute> {
    return runOne<AdminMapRoute>(
        'getRoute',
        db().from('map_routes').select('*').eq('id', id).single(),
    )
}

export async function createRoute(input: MapRouteInput): Promise<AdminMapRoute> {
    return runOne<AdminMapRoute>(
        'createRoute',
        db().from('map_routes').insert(input).select('*').single(),
    )
}

export async function updateRoute(id: number, input: Partial<MapRouteInput>): Promise<AdminMapRoute> {
    return runOne<AdminMapRoute>(
        'updateRoute',
        db().from('map_routes').update(input).eq('id', id).select('*').single(),
    )
}

export async function toggleRouteDisabled(id: number, disabled: boolean): Promise<void> {
    const { error } = await db().from('map_routes').update({ flag_disabled: disabled }).eq('id', id)
    if (error) {
        console.error('toggleRouteDisabled:', error)
        throw new Error(error.message)
    }
}

export async function deleteRoute(id: number): Promise<void> {
    const { error } = await db().from('map_routes').delete().eq('id', id)
    if (error) {
        console.error('deleteRoute:', error)
        throw new Error(error.message)
    }
}

// ===== Submissions =====

export async function listSubmissions(status?: SubmissionStatus): Promise<AdminSubmission[]> {
    let query = db()
        .from('map_points_submissions')
        .select('*')
        .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    return runMany<AdminSubmission>('listSubmissions', query)
}

function asPointCoordinatesFromSubmission(value: unknown): [number, number] {
    if (!Array.isArray(value) || value.length < 2) {
        throw new Error('Некорректные координаты в заявке')
    }
    const lng = Number(value[0])
    const lat = Number(value[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error('Некорректные координаты в заявке')
    }
    return [lng, lat]
}

export async function approveSubmission(id: string): Promise<AdminMapPoint> {
    const sub = await runOne<AdminSubmission>(
        'approveSubmission:fetch',
        db().from('map_points_submissions').select('*').eq('id', id).single(),
    )
    if (sub.status !== 'pending') {
        throw new Error('Заявка уже обработана.')
    }

    const coordinates = asPointCoordinatesFromSubmission(sub.coordinates)

    const inserted = await createPoint({
        type: sub.type,
        title: sub.title,
        description: sub.description,
        coordinates,
        flag_is_meeting: sub.type === 'point' ? sub.flag_is_meeting : false,
        flag_has_socket: sub.type === 'socket',
        flag_disabled: false,
    })

    const { error } = await db()
        .from('map_points_submissions')
        .update({ status: 'approved', processed_at: new Date().toISOString() })
        .eq('id', id)
    if (error) {
        console.error('approveSubmission:update', error)
        throw new Error(error.message)
    }

    return inserted
}

export async function rejectSubmission(id: string): Promise<void> {
    const { error } = await db()
        .from('map_points_submissions')
        .update({ status: 'rejected', processed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending')
    if (error) {
        console.error('rejectSubmission:', error)
        throw new Error(error.message)
    }
}

// ===== Photos =====

interface PhotoRowDB {
    id: string
    created_at: string
    point_id: number
    bucket_name: string
    storage_path: string
    alt_text: string | null
    sort_order: number
}

function withPublicUrl(row: PhotoRowDB): AdminPhoto {
    return { ...row, public_url: publicUrl(row.storage_path) }
}

export async function listPhotos(pointId: number): Promise<AdminPhoto[]> {
    const rows = await runMany<PhotoRowDB>(
        'listPhotos',
        db()
            .from('map_point_photos')
            .select('*')
            .eq('point_id', pointId)
            .order('sort_order', { ascending: true }),
    )
    return rows.map(withPublicUrl)
}

export async function uploadPhoto(
    pointId: number,
    file: File,
    altText: string | null,
    sortOrder: number,
): Promise<AdminPhoto> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = /^(jpe?g|png|webp)$/.test(ext) ? ext.replace('jpeg', 'jpg') : 'jpg'
    const storagePath = `${String(pointId)}/${crypto.randomUUID()}.${safeExt}`

    const { error: uploadError } = await db().storage
        .from(PHOTOS_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) {
        console.error('uploadPhoto:storage', uploadError)
        throw new Error(uploadError.message)
    }

    try {
        const row = await runOne<PhotoRowDB>(
            'uploadPhoto:insert',
            db()
                .from('map_point_photos')
                .insert({
                    point_id: pointId,
                    bucket_name: PHOTOS_BUCKET,
                    storage_path: storagePath,
                    alt_text: altText,
                    sort_order: sortOrder,
                })
                .select('*')
                .single(),
        )
        return withPublicUrl(row)
    } catch (err) {
        // откат загрузки в storage, чтобы не оставлять висячие файлы
        await db().storage.from(PHOTOS_BUCKET).remove([storagePath])
        throw err
    }
}

export async function updatePhoto(
    id: string,
    patch: { alt_text?: string | null; sort_order?: number },
): Promise<AdminPhoto> {
    const row = await runOne<PhotoRowDB>(
        'updatePhoto',
        db().from('map_point_photos').update(patch).eq('id', id).select('*').single(),
    )
    return withPublicUrl(row)
}

export async function deletePhoto(photo: AdminPhoto): Promise<void> {
    const { error: storageError } = await db().storage
        .from(PHOTOS_BUCKET)
        .remove([photo.storage_path])
    if (storageError) {
        console.warn('deletePhoto:storage', storageError)
    }
    const { error } = await db().from('map_point_photos').delete().eq('id', photo.id)
    if (error) {
        console.error('deletePhoto:row', error)
        throw new Error(error.message)
    }
}
