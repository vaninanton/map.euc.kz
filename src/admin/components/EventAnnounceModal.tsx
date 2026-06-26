import { useCallback, useEffect, useState } from 'react'
import {
    announceEventDate,
    deleteEventDateAnnouncements,
    editEventDateAnnouncements,
    listEventAnnouncements,
    listTelegramChats,
    type AdminEvent,
    type AdminEventDate,
    type AdminTelegramChat,
    type AnnounceResult,
} from '@/admin/lib/adminApi'
import { AnnouncementMessagesList } from '@/admin/components/AnnouncementMessagesList'
import {
    buildAnnouncementPreviewBody,
    buildAnnouncementPreviewHeader,
    pendingAnnouncementChats,
} from '@/utils/eventAnnounce'

interface EventAnnounceModalProps {
    event: AdminEvent
    date: AdminEventDate
    /** 'send' (по умолчанию) — первичная отправка с выбором чатов; 'edit' — правка/удаление уже отправленных. */
    mode?: 'send' | 'edit'
    /** Начальный текст body. Для mode='edit' — тело из последнего отправленного сообщения. */
    initialBody?: string
    onClose: () => void
    /** Вызывается после успешной отправки/правки/удаления — родитель перезагружает список. */
    onSent: (result: AnnounceResult | { edited: number } | { deleted: number }) => void
}

/**
 * Модалка управления анонсом даты в Telegram.
 * - mode='send': превью шапки + текст + выбор чатов + закрепление → отправка.
 * - mode='edit': правка текста всех отправленных сообщений + удаление их из Telegram.
 */
export function EventAnnounceModal({
    event,
    date,
    mode = 'send',
    initialBody,
    onClose,
    onSent,
}: EventAnnounceModalProps) {
    const isEdit = mode === 'edit'
    const [chats, setChats] = useState<AdminTelegramChat[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [body, setBody] = useState(() => initialBody ?? buildAnnouncementPreviewBody(event, date))
    const [pin, setPin] = useState(false)
    const [loadingChats, setLoadingChats] = useState(true)
    const [sending, setSending] = useState(false)
    const [sendingNew, setSendingNew] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const header = buildAnnouncementPreviewHeader(event, date)

    const loadChats = useCallback(async () => {
        setLoadingChats(true)
        try {
            const enabled = (await listTelegramChats()).filter((c) => c.enabled)
            // В режиме правки показываем только назначения, куда ещё НЕ отправлено
            // (можно до-отправить), и по умолчанию ничего не выбираем, чтобы не разослать случайно.
            if (isEdit) {
                const sent = await listEventAnnouncements(date.id)
                const pending = pendingAnnouncementChats(enabled, sent)
                setChats(pending)
                setSelected(new Set())
            } else {
                setChats(enabled)
                setSelected(new Set(enabled.map((c) => c.id)))
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoadingChats(false)
        }
    }, [isEdit, date.id])

    useEffect(() => {
        void Promise.resolve().then(() => loadChats())
    }, [loadChats])

    const toggleChat = (destinationId: string) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(destinationId)) next.delete(destinationId)
            else next.add(destinationId)
            return next
        })
    }

    const handleSubmit = async () => {
        if (!isEdit && selected.size === 0) return
        setSending(true)
        setError(null)
        try {
            if (isEdit) {
                onSent(await editEventDateAnnouncements(date.id, body))
            } else {
                onSent(await announceEventDate(date.id, body, [...selected], pin))
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSending(false)
        }
    }

    /** Режим правки: до-отправка текущего текста в выбранные чаты, куда анонс ещё не уходил. */
    const handleSendNew = async () => {
        if (selected.size === 0) return
        setSendingNew(true)
        setError(null)
        try {
            onSent(await announceEventDate(date.id, body, [...selected], pin))
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSendingNew(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Удалить отправленные сообщения этой даты из всех Telegram-чатов?')) return
        setDeleting(true)
        setError(null)
        try {
            onSent(await deleteEventDateAnnouncements(date.id))
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setDeleting(false)
        }
    }

    const busy = sending || sendingNew || deleting
    const submitDisabled = busy || (!isEdit && selected.size === 0)
    const submitLabel = isEdit ? (sending ? 'Сохранение…' : 'Сохранить') : sending ? 'Отправка…' : 'Отправить'

    const chatChecklist = chats.map((chat) => (
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
    ))

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
                <h2 className="text-base font-semibold text-neutral-900">
                    {isEdit ? 'Изменить текст анонса' : 'Анонс в Telegram'}
                </h2>

                <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm whitespace-pre-line text-neutral-700">
                    {header}
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                    Заголовок и дата фиксированы и добавляются автоматически.
                </p>

                <label className="mt-3 block text-xs font-medium text-neutral-700">Текст сообщения</label>
                <textarea
                    value={body}
                    onChange={(e) => {
                        setBody(e.target.value)
                    }}
                    rows={4}
                    className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />

                {isEdit ? (
                    <>
                        <p className="mt-2 text-xs text-neutral-500">
                            Новый текст применится ко всем уже отправленным сообщениям этой даты во всех чатах.
                        </p>
                        <AnnouncementMessagesList eventDateId={date.id} />

                        {/* До-отправка в чаты, куда анонс этой даты ещё не уходил. */}
                        <div className="mt-3 border-t border-neutral-100 pt-3">
                            <p className="text-xs font-medium text-neutral-700">Отправить в новые чаты</p>
                            {loadingChats && <p className="mt-1 text-sm text-neutral-500">Загрузка чатов…</p>}
                            {!loadingChats && chats.length === 0 && (
                                <p className="mt-1 text-sm text-neutral-400">Анонс отправлен во все включённые чаты.</p>
                            )}
                            <div className="mt-1 flex flex-col gap-1">{chatChecklist}</div>
                            {chats.length > 0 && (
                                <button
                                    type="button"
                                    disabled={busy || selected.size === 0}
                                    onClick={() => {
                                        void handleSendNew()
                                    }}
                                    className="mt-2 cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                >
                                    {sendingNew ? 'Отправка…' : 'Отправить текущий текст в выбранные чаты'}
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="mt-3">
                            <p className="text-xs font-medium text-neutral-700">Куда отправить</p>
                            {loadingChats && <p className="mt-1 text-sm text-neutral-500">Загрузка чатов…</p>}
                            {!loadingChats && chats.length === 0 && (
                                <p className="mt-1 text-sm text-neutral-400">
                                    Нет включённых чатов. Добавьте их в разделе «Telegram-чаты».
                                </p>
                            )}
                            <div className="mt-1 flex flex-col gap-1">{chatChecklist}</div>
                        </div>

                        <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
                            <input
                                type="checkbox"
                                checked={pin}
                                onChange={(e) => {
                                    setPin(e.target.checked)
                                }}
                                className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                            />
                            Закрепить сообщение в чате
                        </label>
                    </>
                )}

                {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

                <div className="mt-4 flex items-center gap-2">
                    {/* Удаление всех отправленных сообщений — только в режиме управления отправленным анонсом. */}
                    {isEdit && (
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
                    )}
                    <div className="ml-auto flex gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onClose}
                            className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                        >
                            Отмена
                        </button>
                        <button
                            type="button"
                            disabled={submitDisabled}
                            onClick={() => {
                                void handleSubmit()
                            }}
                            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                        >
                            {submitLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
