import type { AdminNewsAnnouncement, AdminTelegramChat } from '@/admin/lib/adminApi/types'
import { destinationKey } from '@/utils/eventAnnounce'

/** Живое сообщение новости: успешно отправлено и не удалено. */
function isLiveNewsAnnouncement(a: AdminNewsAnnouncement): boolean {
    return a.telegram_message_id !== null && a.send_error === null && a.deleted_at === null
}

/**
 * Назначения (чат+тема), в которые новость ещё НЕ отправлена — для до-отправки из режима правки.
 * «Отправлено» = есть живое сообщение с тем же (chat_id, message_thread_id). Удалённые/ошибочные
 * не считаются отправленными, чтобы такой чат снова попал в список доступных.
 */
export function pendingNewsChats(
    chats: AdminTelegramChat[],
    announcements: AdminNewsAnnouncement[],
): AdminTelegramChat[] {
    const live = new Set(
        announcements
            .filter(isLiveNewsAnnouncement)
            .map((a) => destinationKey(a.telegram_chat_id, a.message_thread_id)),
    )
    return chats.filter((c) => !live.has(destinationKey(c.chat_id, c.message_thread_id)))
}

/** Первая непустая строка новости — короткий заголовок для списков. */
export function newsTitlePreview(body: string, maxLength = 80): string {
    const firstLine =
        body
            .split('\n')
            .find((line) => line.trim().length > 0)
            ?.trim() ?? ''
    if (firstLine.length <= maxLength) return firstLine
    return `${firstLine.slice(0, maxLength).trimEnd()}…`
}
