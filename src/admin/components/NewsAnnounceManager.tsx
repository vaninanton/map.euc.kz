import { useCallback, useEffect, useState } from 'react'
import {
    announceNews,
    deleteNewsAnnouncements,
    editNewsAnnouncements,
    listNewsAnnouncements,
    listTelegramChats,
    type AdminTelegramChat,
} from '@/admin/lib/adminApi'
import { NewsMessagesList } from '@/admin/components/NewsMessagesList'
import { pendingNewsChats } from '@/utils/newsAnnounce'

interface NewsAnnounceManagerProps {
    newsId: string
    /** Текст новости из формы — служит для предупреждения о несохранённых правках. */
    body: string
    /** true, если в форме есть несохранённые изменения текста/фото. */
    hasUnsavedChanges: boolean
}

/**
 * Блок рассылки новости в Telegram: выбор чатов и отправка, синхронизация текста
 * во все отправленные сообщения, удаление из Telegram. Текст берётся из самой новости
 * (редактируется в форме выше), поэтому здесь его не дублируем.
 */
export function NewsAnnounceManager({ newsId, body, hasUnsavedChanges }: NewsAnnounceManagerProps) {
    const [pendingChats, setPendingChats] = useState<AdminTelegramChat[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loadingChats, setLoadingChats] = useState(true)
    const [sending, setSending] = useState(false)
    const [editing, setEditing] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    // Меняется после любой операции — заставляет NewsMessagesList и список чатов перезагрузиться.
    const [refreshKey, setRefreshKey] = useState(0)

    const loadChats = useCallback(async () => {
        setLoadingChats(true)
        try {
            // Два независимых запроса — параллельно.
            const [chats, sent] = await Promise.all([listTelegramChats(), listNewsAnnouncements(newsId)])
            const enabled = chats.filter((c) => c.enabled)
            // По умолчанию ничего не выбираем, чтобы случайно не разослать.
            setPendingChats(pendingNewsChats(enabled, sent))
            setSelected(new Set())
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoadingChats(false)
        }
    }, [newsId])

    useEffect(() => {
        void Promise.resolve().then(() => loadChats())
    }, [loadChats, refreshKey])

    const toggleChat = (destinationId: string) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(destinationId)) next.delete(destinationId)
            else next.add(destinationId)
            return next
        })
    }

    const afterAction = (message: string) => {
        setNotice(message)
        setRefreshKey((k) => k + 1)
    }

    const handleSend = async () => {
        if (selected.size === 0) return
        setSending(true)
        setError(null)
        setNotice(null)
        try {
            const result = await announceNews(newsId, [...selected])
            const failed = result.failed.length
            afterAction(
                failed === 0
                    ? `Отправлено: ${String(result.sent.length)}.`
                    : `Отправлено: ${String(result.sent.length)}, с ошибкой: ${String(failed)}.`,
            )
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSending(false)
        }
    }

    const handleEdit = async () => {
        setEditing(true)
        setError(null)
        setNotice(null)
        try {
            const { edited, failed } = await editNewsAnnouncements(newsId)
            afterAction(
                failed.length === 0
                    ? `Обновлено сообщений: ${String(edited)}.`
                    : `Обновлено: ${String(edited)}, с ошибкой: ${String(failed.length)}.`,
            )
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setEditing(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Удалить отправленные сообщения этой новости из всех Telegram-чатов?')) return
        setDeleting(true)
        setError(null)
        setNotice(null)
        try {
            const { deleted } = await deleteNewsAnnouncements(newsId)
            afterAction(`Удалено сообщений: ${String(deleted)}.`)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setDeleting(false)
        }
    }

    const busy = sending || editing || deleting
    const emptyBody = body.trim().length === 0

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">Рассылка в Telegram</h2>

            {hasUnsavedChanges && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Сначала сохраните изменения текста — рассылка использует сохранённую версию.
                </div>
            )}
            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {notice && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>}

            {/* Отправка в новые чаты. */}
            <div className="mt-3">
                <p className="text-xs font-medium text-neutral-700">Отправить в чаты</p>
                {loadingChats && <p className="mt-1 text-sm text-neutral-500">Загрузка чатов…</p>}
                {!loadingChats && pendingChats.length === 0 && (
                    <p className="mt-1 text-sm text-neutral-400">
                        Новость отправлена во все включённые чаты (или включённых чатов нет).
                    </p>
                )}
                <div className="mt-1 flex flex-col gap-1">
                    {pendingChats.map((chat) => (
                        <label key={chat.id} className="flex items-center gap-2 text-sm text-neutral-700">
                            <input
                                type="checkbox"
                                checked={selected.has(chat.id)}
                                onChange={() => {
                                    toggleChat(chat.id)
                                }}
                                className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                            />
                            {chat.title}
                            <span className="font-mono text-xs text-neutral-400">
                                {chat.chat_id}
                                {chat.message_thread_id !== null && ` / ${String(chat.message_thread_id)}`}
                            </span>
                        </label>
                    ))}
                </div>
                {pendingChats.length > 0 && (
                    <button
                        type="button"
                        disabled={busy || selected.size === 0 || emptyBody || hasUnsavedChanges}
                        onClick={() => {
                            void handleSend()
                        }}
                        className="mt-2 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                    >
                        {sending ? 'Отправка…' : 'Отправить в выбранные чаты'}
                    </button>
                )}
            </div>

            <NewsMessagesList newsId={newsId} refreshKey={refreshKey} />

            {/* Синхронизация текста и удаление отправленного. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                <button
                    type="button"
                    disabled={busy || hasUnsavedChanges}
                    onClick={() => {
                        void handleEdit()
                    }}
                    className="cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                    {editing ? 'Обновление…' : 'Обновить текст во всех отправленных'}
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        void handleDelete()
                    }}
                    className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                    {deleting ? 'Удаление…' : 'Удалить из Telegram'}
                </button>
            </div>
        </div>
    )
}
