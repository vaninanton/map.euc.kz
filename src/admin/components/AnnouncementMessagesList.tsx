import { useCallback, useEffect, useState } from 'react'
import {
    listEventAnnouncements,
    listTelegramChats,
    pinEventAnnouncement,
    type AdminEventAnnouncement,
} from '@/admin/lib/adminApi'
import { formatDate, formatTime } from '@/utils/eventSchedule'

interface AnnouncementMessagesListProps {
    eventDateId: string
}

type AnnouncementStatus = 'live' | 'deleted' | 'cancelled' | 'failed'

/** Статус сообщения по полям строки (приоритет: ошибка → удалено → отменено → живое). */
function statusOf(a: AdminEventAnnouncement): AnnouncementStatus {
    if (a.telegram_message_id === null || a.send_error !== null) return 'failed'
    if (a.deleted_at !== null) return 'deleted'
    if (a.cancelled_at !== null) return 'cancelled'
    return 'live'
}

const STATUS_BADGE: Record<AnnouncementStatus, { label: string; cls: string } | null> = {
    live: null,
    deleted: { label: 'Удалено', cls: 'bg-neutral-100 text-neutral-500' },
    cancelled: { label: 'Отменено', cls: 'bg-red-100 text-red-700' },
    failed: { label: 'Ошибка', cls: 'bg-red-100 text-red-700' },
}

/** «Когда»: дата+время отправки, иначе создания строки. */
function sentLabel(a: AdminEventAnnouncement): string {
    const iso = a.sent_at ?? a.created_at
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return `${formatDate(d)}, ${formatTime(d)}`
}

/**
 * Список отправленных сообщений анонса даты: куда (имя чата) и когда, статус,
 * и для живых — кнопка Закрепить/Открепить (pinned_at).
 */
export function AnnouncementMessagesList({ eventDateId }: AnnouncementMessagesListProps) {
    const [rows, setRows] = useState<AdminEventAnnouncement[] | null>(null)
    const [chatTitles, setChatTitles] = useState<Map<number, string>>(new Map())
    const [error, setError] = useState<string | null>(null)
    const [pinningId, setPinningId] = useState<string | null>(null)

    const load = useCallback(async () => {
        setError(null)
        try {
            const [anns, chats] = await Promise.all([listEventAnnouncements(eventDateId), listTelegramChats()])
            setRows(anns)
            setChatTitles(new Map(chats.map((c) => [c.chat_id, c.title])))
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }, [eventDateId])

    useEffect(() => {
        void Promise.resolve().then(() => load())
    }, [load])

    const chatLabel = (chatId: number) => chatTitles.get(chatId) ?? String(chatId)

    const togglePin = async (a: AdminEventAnnouncement) => {
        setPinningId(a.id)
        setError(null)
        try {
            const { pinned } = await pinEventAnnouncement(a.id, a.pinned_at === null)
            // Локально обновляем строку, не перезагружая весь список.
            setRows(
                (prev) =>
                    prev?.map((r) =>
                        r.id === a.id ? { ...r, pinned_at: pinned ? new Date().toISOString() : null } : r,
                    ) ?? null,
            )
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setPinningId(null)
        }
    }

    return (
        <div className="mt-3">
            <p className="text-xs font-medium text-neutral-700">Отправленные сообщения</p>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            {rows === null && !error && <p className="mt-1 text-xs text-neutral-500">Загрузка…</p>}
            {rows !== null && rows.length === 0 && <p className="mt-1 text-xs text-neutral-400">Сообщений ещё нет.</p>}
            {rows !== null && rows.length > 0 && (
                <ul className="mt-1 flex flex-col divide-y divide-neutral-100">
                    {rows.map((a) => {
                        const status = statusOf(a)
                        const badge = STATUS_BADGE[status]
                        const isPinned = a.pinned_at !== null
                        return (
                            <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                                <div className="min-w-0">
                                    <span className="font-medium text-neutral-800">
                                        {chatLabel(a.telegram_chat_id)}
                                    </span>
                                    <span className="ml-2 text-neutral-500">{sentLabel(a)}</span>
                                    {badge && (
                                        <span className={`ml-2 rounded px-1.5 py-0.5 ${badge.cls}`}>{badge.label}</span>
                                    )}
                                    {status === 'live' && isPinned && (
                                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                                            📌 Закреплено
                                        </span>
                                    )}
                                </div>
                                {status === 'live' && (
                                    <button
                                        type="button"
                                        disabled={pinningId === a.id}
                                        onClick={() => {
                                            void togglePin(a)
                                        }}
                                        className="shrink-0 cursor-pointer rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
                                    >
                                        {pinningId === a.id ? '…' : isPinned ? 'Открепить' : 'Закрепить'}
                                    </button>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
