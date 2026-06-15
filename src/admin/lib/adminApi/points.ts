import type { AdminMapPoint, MapPointInput } from '@/admin/lib/adminApi/types'
import { PHOTOS_BUCKET } from '@/admin/lib/adminApi/constants'
import { db, runManyParsed, runOneParsed } from '@/admin/lib/adminApi/query'
import { parseAdminMapPoint } from '@/admin/lib/adminApi/parsers'
import { listPhotos } from '@/admin/lib/adminApi/photos'

/** Возвращает список точек/розеток для админки в алфавитном порядке с числом фото. */
export async function listPoints(): Promise<AdminMapPoint[]> {
    return runManyParsed(
        'listPoints',
        db().from('map_points').select('*, map_point_photos(count)').order('title', { ascending: true }),
        (raw) => parseAdminMapPoint(raw),
    )
}

/** Загружает одну точку по id с runtime-валидацией ответа. */
export async function getPoint(id: number): Promise<AdminMapPoint> {
    return runOneParsed(
        'getPoint',
        db().from('map_points').select('*').eq('id', id).single(),
        parseAdminMapPoint,
    )
}

/** Создаёт новую точку/розетку и возвращает сохранённую запись. */
export async function createPoint(input: MapPointInput): Promise<AdminMapPoint> {
    return runOneParsed(
        'createPoint',
        db().from('map_points').insert(input).select('*').single(),
        parseAdminMapPoint,
    )
}

/** Обновляет существующую точку по id и возвращает актуальную запись. */
export async function updatePoint(id: number, input: Partial<MapPointInput>): Promise<AdminMapPoint> {
    return runOneParsed(
        'updatePoint',
        db().from('map_points').update(input).eq('id', id).select('*').single(),
        parseAdminMapPoint,
    )
}

/** Быстрый переключатель флага скрытия точки на карте. */
export async function togglePointDisabled(id: number, disabled: boolean): Promise<void> {
    const { error } = await db().from('map_points').update({ flag_disabled: disabled }).eq('id', id)
    if (error) {
        console.error('togglePointDisabled:', error)
        throw new Error(error.message)
    }
}

/**
 * Удаляет точку и связанные фото:
 * сначала очищает файлы из Storage, затем строку точки в БД.
 */
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
