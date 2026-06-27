import type { AdminNews, NewsInput } from '@/admin/lib/adminApi/types'
import { NEWS_PHOTOS_BUCKET } from '@/admin/lib/adminApi/constants'
import { db, runManyParsed, runOneParsed } from '@/admin/lib/adminApi/query'
import { parseAdminNews } from '@/admin/lib/adminApi/parsers'

const NEWS_COLUMNS = 'id, created_at, body, photo_path'

/** Список новостей (не удалённых), новые сверху. */
export async function listNews(): Promise<AdminNews[]> {
    return runManyParsed(
        'listNews',
        db().from('map_news').select(NEWS_COLUMNS).is('deleted_at', null).order('created_at', { ascending: false }),
        (raw) => parseAdminNews(raw),
    )
}

export async function getNews(id: string): Promise<AdminNews> {
    return runOneParsed('getNews', db().from('map_news').select(NEWS_COLUMNS).eq('id', id).single(), parseAdminNews)
}

export async function createNews(input: NewsInput): Promise<AdminNews> {
    return runOneParsed('createNews', db().from('map_news').insert(input).select(NEWS_COLUMNS).single(), parseAdminNews)
}

export async function updateNews(id: string, input: Partial<NewsInput>): Promise<AdminNews> {
    return runOneParsed(
        'updateNews',
        db().from('map_news').update(input).eq('id', id).select(NEWS_COLUMNS).single(),
        parseAdminNews,
    )
}

/**
 * Мягко удаляет новость (deleted_at) и удаляет её фото из Storage.
 * Строки telegram_outbound_messages остаются (история отправок); сами сообщения
 * в Telegram при необходимости удаляются отдельно через deleteNewsAnnouncements.
 */
export async function deleteNews(news: Pick<AdminNews, 'id' | 'photo_path'>): Promise<void> {
    if (news.photo_path) {
        await db().storage.from(NEWS_PHOTOS_BUCKET).remove([news.photo_path])
    }
    const { error } = await db().from('map_news').update({ deleted_at: new Date().toISOString() }).eq('id', news.id)
    if (error) {
        console.error('deleteNews:', error)
        throw new Error(error.message)
    }
}

/**
 * Загружает фотографию новости в Storage и сохраняет путь в `photo_path`.
 * Старое фото (если было) удаляется. Возвращает обновлённую новость.
 */
export async function setNewsPhoto(newsId: string, file: File, previousPath: string | null): Promise<AdminNews> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = /^(jpe?g|png|webp)$/.test(ext) ? ext.replace('jpeg', 'jpg') : 'jpg'
    const storagePath = `${newsId}/${crypto.randomUUID()}.${safeExt}`

    const { error: uploadError } = await db()
        .storage.from(NEWS_PHOTOS_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) {
        console.error('setNewsPhoto:storage', uploadError)
        throw new Error(uploadError.message)
    }

    try {
        const updated = await runOneParsed(
            'setNewsPhoto',
            db().from('map_news').update({ photo_path: storagePath }).eq('id', newsId).select(NEWS_COLUMNS).single(),
            parseAdminNews,
        )
        if (previousPath && previousPath !== storagePath) {
            await db().storage.from(NEWS_PHOTOS_BUCKET).remove([previousPath])
        }
        return updated
    } catch (err) {
        await db().storage.from(NEWS_PHOTOS_BUCKET).remove([storagePath])
        throw err
    }
}

/** Удаляет фотографию новости из Storage и обнуляет `photo_path`. */
export async function deleteNewsPhoto(newsId: string, photoPath: string): Promise<AdminNews> {
    const { error: storageError } = await db().storage.from(NEWS_PHOTOS_BUCKET).remove([photoPath])
    if (storageError) {
        console.warn('deleteNewsPhoto:storage', storageError)
    }
    return runOneParsed(
        'deleteNewsPhoto',
        db().from('map_news').update({ photo_path: null }).eq('id', newsId).select(NEWS_COLUMNS).single(),
        parseAdminNews,
    )
}

/** Публичный URL фотографии новости (для предпросмотра в админке). */
export function newsPhotoUrl(photoPath: string): string {
    return db().storage.from(NEWS_PHOTOS_BUCKET).getPublicUrl(photoPath).data.publicUrl
}
