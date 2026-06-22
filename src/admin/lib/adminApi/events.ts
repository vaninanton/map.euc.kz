import type { AdminEvent, AdminEventDate, EventDateInput, EventDatePatch, EventInput } from '@/admin/lib/adminApi/types'
import { EVENT_PHOTOS_BUCKET } from '@/admin/lib/adminApi/constants'
import { db, runManyParsed, runOneParsed } from '@/admin/lib/adminApi/query'
import { parseAdminEvent, parseAdminEventDate } from '@/admin/lib/adminApi/parsers'

const EVENT_COLUMNS =
    'id, created_at, type, title, description, photo_path, duration_minutes, location_text, start_coordinates, finish_coordinates, start_point_id, finish_point_id, flag_disabled'

/** Список событий, отсортированный по дате создания (новые сверху). */
export async function listEvents(): Promise<AdminEvent[]> {
    return runManyParsed(
        'listEvents',
        db().from('map_events').select(EVENT_COLUMNS).order('created_at', { ascending: false }),
        (raw) => parseAdminEvent(raw),
    )
}

export async function getEvent(id: number): Promise<AdminEvent> {
    return runOneParsed(
        'getEvent',
        db().from('map_events').select(EVENT_COLUMNS).eq('id', id).single(),
        parseAdminEvent,
    )
}

export async function createEvent(input: EventInput): Promise<AdminEvent> {
    return runOneParsed(
        'createEvent',
        db().from('map_events').insert(input).select(EVENT_COLUMNS).single(),
        parseAdminEvent,
    )
}

export async function updateEvent(id: number, input: Partial<EventInput>): Promise<AdminEvent> {
    return runOneParsed(
        'updateEvent',
        db().from('map_events').update(input).eq('id', id).select(EVENT_COLUMNS).single(),
        parseAdminEvent,
    )
}

export async function toggleEventDisabled(id: number, disabled: boolean): Promise<void> {
    const { error } = await db().from('map_events').update({ flag_disabled: disabled }).eq('id', id)
    if (error) {
        console.error('toggleEventDisabled:', error)
        throw new Error(error.message)
    }
}

/** Удаляет событие, его фото из Storage и (по CASCADE) даты. */
export async function deleteEvent(event: Pick<AdminEvent, 'id' | 'photo_path'>): Promise<void> {
    if (event.photo_path) {
        await db().storage.from(EVENT_PHOTOS_BUCKET).remove([event.photo_path])
    }
    const { error } = await db().from('map_events').delete().eq('id', event.id)
    if (error) {
        console.error('deleteEvent:', error)
        throw new Error(error.message)
    }
}

/**
 * Загружает фотографию события в Storage и сохраняет путь в `photo_path`.
 * Старое фото (если было) удаляется из Storage. Возвращает обновлённое событие.
 */
export async function setEventPhoto(eventId: number, file: File, previousPath: string | null): Promise<AdminEvent> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = /^(jpe?g|png|webp)$/.test(ext) ? ext.replace('jpeg', 'jpg') : 'jpg'
    const storagePath = `${String(eventId)}/${crypto.randomUUID()}.${safeExt}`

    const { error: uploadError } = await db().storage
        .from(EVENT_PHOTOS_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) {
        console.error('setEventPhoto:storage', uploadError)
        throw new Error(uploadError.message)
    }

    try {
        const updated = await updateEvent(eventId, { photo_path: storagePath } as Partial<EventInput> & {
            photo_path: string
        })
        if (previousPath && previousPath !== storagePath) {
            await db().storage.from(EVENT_PHOTOS_BUCKET).remove([previousPath])
        }
        return updated
    } catch (err) {
        await db().storage.from(EVENT_PHOTOS_BUCKET).remove([storagePath])
        throw err
    }
}

/** Удаляет фотографию события из Storage и обнуляет `photo_path`. */
export async function deleteEventPhoto(eventId: number, photoPath: string): Promise<AdminEvent> {
    const { error: storageError } = await db().storage.from(EVENT_PHOTOS_BUCKET).remove([photoPath])
    if (storageError) {
        console.warn('deleteEventPhoto:storage', storageError)
    }
    return updateEvent(eventId, { photo_path: null } as Partial<EventInput> & { photo_path: null })
}

/** Публичный URL фотографии события (для предпросмотра в админке). */
export function eventPhotoUrl(photoPath: string): string {
    return db().storage.from(EVENT_PHOTOS_BUCKET).getPublicUrl(photoPath).data.publicUrl
}

const EVENT_DATE_COLUMNS = 'id, starts_at, note, cancelled'

/** Даты события, отсортированные по времени. */
export async function listEventDates(eventId: number): Promise<AdminEventDate[]> {
    return runManyParsed(
        'listEventDates',
        db()
            .from('map_event_dates')
            .select(EVENT_DATE_COLUMNS)
            .eq('event_id', eventId)
            .order('starts_at', { ascending: true }),
        (raw) => parseAdminEventDate(raw),
    )
}

export async function addEventDate(eventId: number, input: EventDateInput): Promise<AdminEventDate> {
    const { data, error } = await db()
        .from('map_event_dates')
        .insert({ event_id: eventId, ...input })
        .select(EVENT_DATE_COLUMNS)
        .single()
    if (error) {
        console.error('addEventDate:', error)
        // 23505 — нарушение UNIQUE (event_id, starts_at): такая дата-время уже есть.
        if (error.code === '23505') throw new Error('Такая дата и время уже добавлены.')
        throw new Error(error.message)
    }
    return parseAdminEventDate(data)
}

export async function updateEventDate(id: string, patch: EventDatePatch): Promise<AdminEventDate> {
    const { data, error } = await db()
        .from('map_event_dates')
        .update(patch)
        .eq('id', id)
        .select(EVENT_DATE_COLUMNS)
        .single()
    if (error) {
        console.error('updateEventDate:', error)
        if (error.code === '23505') throw new Error('Такая дата и время уже добавлены.')
        throw new Error(error.message)
    }
    return parseAdminEventDate(data)
}

export async function deleteEventDate(id: string): Promise<void> {
    const { error } = await db().from('map_event_dates').delete().eq('id', id)
    if (error) {
        console.error('deleteEventDate:', error)
        throw new Error(error.message)
    }
}
