import { useCallback, useState, type KeyboardEvent } from 'react'
import {
    createTelegramChat,
    deleteTelegramChat,
    listTelegramChats,
    updateTelegramChat,
    type AdminTelegramChat,
} from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'

export function TelegramChatsPage() {
    const load = useCallback(() => listTelegramChats(), [])
    const { items, loading, error, reload } = useAdminListLoader(load)

    const [busyId, setBusyId] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)
    const [newChatId, setNewChatId] = useState('')
    const [newTitle, setNewTitle] = useState('')
    const [newThreadId, setNewThreadId] = useState('')
    const [formError, setFormError] = useState<string | null>(null)

    const handleToggle = async (chat: AdminTelegramChat) => {
        setBusyId(chat.id)
        try {
            await updateTelegramChat(chat.id, { enabled: !chat.enabled })
            await reload()
        } catch (err) {
            window.alert(err instanceof Error ? err.message : String(err))
        } finally {
            setBusyId(null)
        }
    }

    const handleDelete = async (chat: AdminTelegramChat) => {
        if (!window.confirm(`Удалить чат «${chat.title}» (${String(chat.chat_id)})?`)) return
        setBusyId(chat.id)
        try {
            await deleteTelegramChat(chat.id)
            await reload()
        } catch (err) {
            window.alert(err instanceof Error ? err.message : String(err))
        } finally {
            setBusyId(null)
        }
    }

    const handleAdd = async () => {
        const chatId = Number(newChatId.trim())
        if (!Number.isFinite(chatId) || chatId === 0) {
            setFormError('Укажите числовой chat_id (для групп — отрицательный).')
            return
        }
        if (newTitle.trim().length === 0) {
            setFormError('Укажите название чата.')
            return
        }
        // Тема форумной группы — необязательна; пусто = обычный чат/General.
        const threadRaw = newThreadId.trim()
        let threadId: number | null = null
        if (threadRaw.length > 0) {
            const n = Number(threadRaw)
            if (!Number.isInteger(n) || n <= 0) {
                setFormError('ID темы — положительное целое число (или оставьте пустым).')
                return
            }
            threadId = n
        }
        setAdding(true)
        setFormError(null)
        try {
            await createTelegramChat({
                chat_id: chatId,
                title: newTitle.trim(),
                enabled: true,
                sort_order: items.length,
                message_thread_id: threadId,
            })
            setNewChatId('')
            setNewTitle('')
            setNewThreadId('')
            await reload()
        } catch (err) {
            setFormError(err instanceof Error ? err.message : String(err))
        } finally {
            setAdding(false)
        }
    }

    const handleAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            if (!adding) void handleAdd()
        }
    }

    return (
        <section>
            <header className="mb-4 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold">Telegram-чаты</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Чаты для рассылки анонсов событий. Включённые показываются чекбоксами при отправке. Чтобы узнать
                        chat_id группы, добавьте бота в неё и посмотрите логи вебхука.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        void reload()
                    }}
                    className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                >
                    Обновить
                </button>
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                            <th className="px-3 py-2 font-medium">chat_id</th>
                            <th className="px-3 py-2 font-medium">Название</th>
                            <th className="px-3 py-2 font-medium">Тема</th>
                            <th className="px-3 py-2 font-medium">Включён</th>
                            <th className="px-3 py-2 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {loading && (
                            <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                                    Загрузка…
                                </td>
                            </tr>
                        )}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                                    Чатов пока нет.
                                </td>
                            </tr>
                        )}
                        {items.map((chat) => (
                            <tr key={chat.id}>
                                <td className="px-3 py-2 font-mono text-xs text-neutral-500">{chat.chat_id}</td>
                                <td className="px-3 py-2 font-medium">{chat.title}</td>
                                <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                                    {chat.message_thread_id ?? '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <button
                                        type="button"
                                        disabled={busyId === chat.id}
                                        onClick={() => {
                                            void handleToggle(chat)
                                        }}
                                        className={[
                                            'cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition disabled:opacity-50',
                                            chat.enabled
                                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300',
                                        ].join(' ')}
                                    >
                                        {chat.enabled ? 'включён' : 'выключен'}
                                    </button>
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <button
                                        type="button"
                                        disabled={busyId === chat.id}
                                        onClick={() => {
                                            void handleDelete(chat)
                                        }}
                                        className="cursor-pointer rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-neutral-800">Добавить чат</h2>
                {formError && (
                    <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-700">chat_id</label>
                        <input
                            value={newChatId}
                            onChange={(e) => {
                                setNewChatId(e.target.value)
                            }}
                            onKeyDown={handleAddKeyDown}
                            placeholder="131396 или -100…"
                            className="w-44 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-neutral-700">Название</label>
                        <input
                            value={newTitle}
                            onChange={(e) => {
                                setNewTitle(e.target.value)
                            }}
                            onKeyDown={handleAddKeyDown}
                            placeholder="Моноколёса Алматы"
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-700">Тема (необязательно)</label>
                        <input
                            value={newThreadId}
                            onChange={(e) => {
                                setNewThreadId(e.target.value)
                            }}
                            onKeyDown={handleAddKeyDown}
                            placeholder="ID темы форума"
                            className="w-36 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={adding}
                        onClick={() => {
                            void handleAdd()
                        }}
                        className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                    >
                        Добавить
                    </button>
                </div>
            </div>
        </section>
    )
}
