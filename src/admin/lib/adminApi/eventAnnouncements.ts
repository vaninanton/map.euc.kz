import type { AdminEventAnnouncement, AdminEventParticipant, AnnounceResult } from '@/admin/lib/adminApi/types'
import { db, runManyParsed } from '@/admin/lib/adminApi/query'
import { invokeAnnounce, numField } from '@/admin/lib/adminApi/announceClient'
import {
    parseAdminEventAnnouncement,
    parseAdminEventParticipant,
    parseAnnounceResult,
} from '@/admin/lib/adminApi/parsers'

/**
 * Отправляет анонс даты события в выбранные назначения (через Edge Function).
 * destinationIds — суррогатные id строк telegram_chats (чат+тема), не chat_id.
 */
export async function announceEventDate(
    eventDateId: string,
    messageText: string,
    destinationIds: string[],
    pin = false,
): Promise<AnnounceResult> {
    const data = await invokeAnnounce('announce', {
        event_date_id: eventDateId,
        message_text: messageText,
        destination_ids: destinationIds,
        pin,
    })
    return parseAnnounceResult(data)
}

/**
 * Помечает все анонсы даты как отменённые: сообщения редактируются в «ОТМЕНЕНО»,
 * кнопка «Участвую» убирается. Вызывается при отмене даты.
 */
export async function cancelEventDateAnnouncements(eventDateId: string): Promise<{ cancelled: number }> {
    const data = await invokeAnnounce('announce-cancel', { event_date_id: eventDateId })
    return { cancelled: numField(data, 'cancelled') }
}

/**
 * Меняет текст всех живых анонсов даты (новое тело; шапка перестраивается сервером).
 * Возвращает число изменённых сообщений и список ошибок по чатам.
 */
export async function editEventDateAnnouncements(
    eventDateId: string,
    messageText: string,
): Promise<{ edited: number; failed: Array<{ chat_id: number; error: string }> }> {
    const data = await invokeAnnounce('announce-edit', { event_date_id: eventDateId, message_text: messageText })
    const rec = (data ?? {}) as { failed?: unknown }
    return {
        edited: numField(data, 'edited'),
        failed: Array.isArray(rec.failed) ? (rec.failed as Array<{ chat_id: number; error: string }>) : [],
    }
}

/**
 * Удаляет сообщения анонса даты из Telegram (строки в БД помечаются deleted_at).
 * Возвращает число удалённых сообщений.
 */
export async function deleteEventDateAnnouncements(eventDateId: string): Promise<{ deleted: number }> {
    const data = await invokeAnnounce('announce-delete', { event_date_id: eventDateId })
    return { deleted: numField(data, 'deleted') }
}

/** Участники конкретной даты (с профилями Telegram), отсортированные по времени записи. */
export async function listEventParticipants(eventDateId: string): Promise<AdminEventParticipant[]> {
    return runManyParsed(
        'listEventParticipants',
        db()
            .from('map_event_participants')
            .select('created_at, telegram_user_id, telegram_profiles(username, first_name, last_name, avatar_url)')
            .eq('event_date_id', eventDateId)
            .order('created_at', { ascending: true }),
        (raw) => parseAdminEventParticipant(raw),
    )
}

/**
 * (От)закрепляет одно отправленное сообщение анонса в чате.
 * Возвращает новое состояние pinned.
 */
export async function pinEventAnnouncement(announcementId: string, pin: boolean): Promise<{ pinned: boolean }> {
    const data = await invokeAnnounce('announce-pin', { announcement_id: announcementId, pin })
    return { pinned: (data as { pinned?: unknown } | null)?.pinned === true }
}

const ANNOUNCEMENT_COLUMNS =
    'id, created_at, event_date_id, telegram_chat_id, message_thread_id, telegram_message_id, body_text, photo_path, sent_at, send_error, cancelled_at, deleted_at, pinned_at'

/** Отправленные анонсы по дате (для индикации «уже отправлено»). */
export async function listEventAnnouncements(eventDateId: string): Promise<AdminEventAnnouncement[]> {
    return runManyParsed(
        'listEventAnnouncements',
        db()
            .from('telegram_outbound_messages')
            .select(ANNOUNCEMENT_COLUMNS)
            .eq('event_date_id', eventDateId)
            .order('created_at', { ascending: false }),
        (raw) => parseAdminEventAnnouncement(raw),
    )
}

/**
 * Анонсы сразу по нескольким датам одним запросом (избегаем N+1 при загрузке списка дат).
 * Отсортированы по created_at desc — первый живой анонс даты = последний отправленный.
 */
export async function listEventAnnouncementsForDates(eventDateIds: string[]): Promise<AdminEventAnnouncement[]> {
    if (eventDateIds.length === 0) return []
    return runManyParsed(
        'listEventAnnouncementsForDates',
        db()
            .from('telegram_outbound_messages')
            .select(ANNOUNCEMENT_COLUMNS)
            .in('event_date_id', eventDateIds)
            .order('created_at', { ascending: false }),
        (raw) => parseAdminEventAnnouncement(raw),
    )
}
