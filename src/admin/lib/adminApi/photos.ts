import type { AdminPhoto } from '@/admin/lib/adminApi/types'
import { PHOTOS_BUCKET } from '@/admin/lib/adminApi/constants'
import { db, runManyParsed, runOneParsed } from '@/admin/lib/adminApi/query'
import { parsePhotoRowDB, type PhotoRowDB } from '@/admin/lib/adminApi/parsers'

function publicUrl(storagePath: string): string {
    return db().storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function withPublicUrl(row: PhotoRowDB): AdminPhoto {
    return { ...row, public_url: publicUrl(row.storage_path) }
}

export async function listPhotos(pointId: number): Promise<AdminPhoto[]> {
    const rows = await runManyParsed(
        'listPhotos',
        db()
            .from('map_point_photos')
            .select('*')
            .eq('point_id', pointId)
            .order('sort_order', { ascending: true }),
        (raw) => parsePhotoRowDB(raw),
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
        const row = await runOneParsed(
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
            parsePhotoRowDB,
        )
        return withPublicUrl(row)
    } catch (err) {
        await db().storage.from(PHOTOS_BUCKET).remove([storagePath])
        throw err
    }
}

export async function updatePhoto(
    id: string,
    patch: { alt_text?: string | null; sort_order?: number },
): Promise<AdminPhoto> {
    const row = await runOneParsed(
        'updatePhoto',
        db().from('map_point_photos').update(patch).eq('id', id).select('*').single(),
        parsePhotoRowDB,
    )
    return withPublicUrl(row)
}

export async function deletePhoto(photo: AdminPhoto): Promise<void> {
    const { error: storageError } = await db().storage.from(PHOTOS_BUCKET).remove([photo.storage_path])
    if (storageError) {
        console.warn('deletePhoto:storage', storageError)
    }
    const { error } = await db().from('map_point_photos').delete().eq('id', photo.id)
    if (error) {
        console.error('deletePhoto:row', error)
        throw new Error(error.message)
    }
}
