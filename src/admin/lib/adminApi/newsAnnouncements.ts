import type { AdminNewsAnnouncement, AnnounceResult } from '@/admin/lib/adminApi/types'
import { db, runManyParsed } from '@/admin/lib/adminApi/query'
import { invokeAnnounce, numField } from '@/admin/lib/adminApi/announceClient'
import { parseAdminNewsAnnouncement, parseAnnounceResult } from '@/admin/lib/adminApi/parsers'

/**
 * Отправляет новость в выбранные назначения (через Edge Function).
 * destinationIds — суррогатные id строк telegram_chats (чат+тема), не chat_id.
 */
export async function announceNews(newsId: string, destinationIds: string[]): Promise<AnnounceResult> {
    const data = await invokeAnnounce('news-announce', { news_id: newsId, destination_ids: destinationIds })
    return parseAnnounceResult(data)
}

/**
 * Меняет текст всех живых сообщений новости (берёт актуальное тело из map_news).
 * Возвращает число изменённых сообщений и список ошибок по чатам.
 */
export async function editNewsAnnouncements(
    newsId: string,
): Promise<{ edited: number; failed: Array<{ chat_id: number; error: string }> }> {
    const data = await invokeAnnounce('news-announce-edit', { news_id: newsId })
    const rec = (data ?? {}) as { failed?: unknown }
    return {
        edited: numField(data, 'edited'),
        failed: Array.isArray(rec.failed) ? (rec.failed as Array<{ chat_id: number; error: string }>) : [],
    }
}

/**
 * Удаляет сообщения новости из Telegram (строки помечаются deleted_at).
 * Возвращает число удалённых сообщений.
 */
export async function deleteNewsAnnouncements(newsId: string): Promise<{ deleted: number }> {
    const data = await invokeAnnounce('news-announce-delete', { news_id: newsId })
    return { deleted: numField(data, 'deleted') }
}

const NEWS_ANNOUNCEMENT_COLUMNS =
    'id, created_at, news_id, telegram_chat_id, message_thread_id, telegram_message_id, photo_path, sent_at, send_error, deleted_at'

/** Отправленные сообщения новости (для индикации «уже отправлено» и истории). */
export async function listNewsAnnouncements(newsId: string): Promise<AdminNewsAnnouncement[]> {
    return runManyParsed(
        'listNewsAnnouncements',
        db()
            .from('telegram_outbound_messages')
            .select(NEWS_ANNOUNCEMENT_COLUMNS)
            .eq('news_id', newsId)
            .order('created_at', { ascending: false }),
        (raw) => parseAdminNewsAnnouncement(raw),
    )
}
