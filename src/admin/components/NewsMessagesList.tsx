import { useCallback, useEffect, useState } from 'react'
import { listNewsAnnouncements, listTelegramChats, type AdminNewsAnnouncement } from '@/admin/lib/adminApi'
import { formatDate, formatTime } from '@/utils/eventSchedule'

interface NewsMessagesListProps {
    newsId: string
    /** Меняется родителем после отправки/правки/удаления, чтобы перезагрузить список. */
    refreshKey: number
}

type NewsMessageStatus = 'live' | 'deleted' | 'failed'

/** Статус сообщения по полям строки (приоритет: ошибка → удалено → живое). */
function statusOf(a: AdminNewsAnnouncement): NewsMessageStatus {
    if (a.telegram_message_id === null || a.send_error !== null) return 'failed'
    if (a.deleted_at !== null) return 'deleted'
    return 'live'
}

const STATUS_BADGE: Record<NewsMessageStatus, { label: string; cls: string } | null> = {
    live: null,
    deleted: { label: 'Удалено', cls: 'bg-neutral-100 text-neutral-500' },
    failed: { label: 'Ошибка', cls: 'bg-red-100 text-red-700' },
}

/** «Когда»: дата+время отправки, иначе создания строки. */
function sentLabel(a: AdminNewsAnnouncement): string {
    const iso = a.sent_at ?? a.created_at
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return `${formatDate(d)}, ${formatTime(d)}`
}

/** Список отправленных сообщений новости: куда (имя чата), когда и статус. */
export function NewsMessagesList({ newsId, refreshKey }: NewsMessagesListProps) {
    const [rows, setRows] = useState<AdminNewsAnnouncement[] | null>(null)
    const [chatTitles, setChatTitles] = useState<Map<number, string>>(new Map())
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setError(null)
        try {
            const [anns, chats] = await Promise.all([listNewsAnnouncements(newsId), listTelegramChats()])
            setRows(anns)
            setChatTitles(new Map(chats.map((c) => [c.chat_id, c.title])))
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }, [newsId])

    useEffect(() => {
        void Promise.resolve().then(() => load())
    }, [load, refreshKey])

    const chatLabel = (chatId: number) => chatTitles.get(chatId) ?? String(chatId)

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
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
