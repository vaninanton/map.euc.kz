import { EVENT_TYPE_LABELS } from '@/constants'
import { formatDate, formatTime } from '@/utils/eventSchedule'
import type { AdminEvent, AdminEventDate, AdminEventAnnouncement, AdminTelegramChat } from '@/admin/lib/adminApi/types'

/**
 * Фиксированная шапка анонса для предпросмотра в админке: «Покатушка · Название · вторник, 14 июля, 19:00».
 * Показывает абсолютное время (в зоне браузера админа) — это фолбэк, который сервер
 * дополняет относительным <tg-time format="r"> «(через 3 часа)» в зоне каждого юзера.
 * Держать в синхроне с buildAnnouncementHeader в supabase/functions/telegram-location-bot/_pure.ts.
 */
export function buildAnnouncementPreviewHeader(
    event: Pick<AdminEvent, 'type' | 'title'>,
    date: AdminEventDate,
): string {
    const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type
    const d = new Date(date.starts_at)
    const weekday = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { weekday: 'long' })
    const datePart = Number.isNaN(d.getTime()) ? '' : `${weekday}, ${formatDate(d)}, ${formatTime(d)}`
    // Если первое слово типа совпадает с первым словом названия — тип опускаем
    // (чтобы не было «Обучение · Обучение по пятницам…»). Держать в синхроне с _pure.ts.
    const firstWordKey = (s: string) => (s.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    const head =
        firstWordKey(typeLabel) && firstWordKey(typeLabel) === firstWordKey(event.title)
            ? event.title
            : `${typeLabel} · ${event.title}`
    return datePart ? `${head}\n📅 ${datePart}` : head
}

/** Ключ назначения рассылки: чат + тема. NULL-тема нормализуется отдельно от любого id темы. */
function destinationKey(chatId: number, threadId: number | null): string {
    return `${String(chatId)}:${threadId === null ? '' : String(threadId)}`
}

/** Живое сообщение анонса: успешно отправлено и не удалено/не отменено. */
function isLiveAnnouncement(a: AdminEventAnnouncement): boolean {
    return a.telegram_message_id !== null && a.send_error === null && a.deleted_at === null && a.cancelled_at === null
}

/**
 * Назначения (чат+тема), в которые анонс даты ещё НЕ отправлен — для до-отправки из режима правки.
 * «Отправлено» = есть живое сообщение с тем же (chat_id, message_thread_id). Удалённые/отменённые/
 * ошибочные не считаются отправленными, чтобы такой чат снова попал в список доступных.
 */
export function pendingAnnouncementChats(
    chats: AdminTelegramChat[],
    announcements: AdminEventAnnouncement[],
): AdminTelegramChat[] {
    const live = new Set(
        announcements.filter(isLiveAnnouncement).map((a) => destinationKey(a.telegram_chat_id, a.message_thread_id)),
    )
    return chats.filter((c) => !live.has(destinationKey(c.chat_id, c.message_thread_id)))
}

/**
 * Текст-заготовка для редактируемой textarea: заметка к дате + место.
 * Админ правит этот текст; шапку (заголовок/дату) сервер подставляет сам.
 */
export function buildAnnouncementPreviewBody(
    event: Pick<AdminEvent, 'location_text'>,
    date: Pick<AdminEventDate, 'note'>,
): string {
    const lines: string[] = []
    if (date.note) lines.push(date.note)
    if (event.location_text) lines.push(`📍 ${event.location_text}`)
    return lines.join('\n')
}
