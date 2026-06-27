import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import {
    addEventDate,
    cancelEventDateAnnouncements,
    deleteEventDate,
    listEventAnnouncementsForDates,
    listEventDates,
    listEventParticipants,
    updateEventDate,
    type AdminEvent,
    type AdminEventDate,
    type AdminEventParticipant,
} from '@/admin/lib/adminApi'
import { EventAnnounceModal } from '@/admin/components/EventAnnounceModal'
import { formatDate, formatTime } from '@/utils/eventSchedule'

interface EventDatesManagerProps {
    event: AdminEvent
}

/**
 * Имя участника для отображения: имя/фамилия, иначе @username (если есть), иначе id.
 * username выводится отдельной ссылкой, поэтому здесь возвращаем его только как fallback.
 */
function participantName(p: AdminEventParticipant): string {
    const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
    if (full) return full
    if (p.username) return `@${p.username}`
    return `id${String(p.telegram_user_id)}`
}

/** Есть ли у участника отображаемое имя помимо username (чтобы не дублировать @username). */
function hasRealName(p: AdminEventParticipant): boolean {
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim().length > 0
}

/** Раскрываемый список участников даты с количеством и аватарами. */
function ParticipantsBlock({ eventDateId }: { eventDateId: string }) {
    const [open, setOpen] = useState(false)
    const [participants, setParticipants] = useState<AdminEventParticipant[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            setParticipants(await listEventParticipants(eventDateId))
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [eventDateId])

    const toggleOpen = () => {
        const next = !open
        setOpen(next)
        if (next && participants === null) void load()
    }

    return (
        <div className="mt-1">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={toggleOpen}
                    className="cursor-pointer text-xs font-medium text-blue-700 hover:underline"
                >
                    {open ? 'Скрыть участников' : 'Показать участников'}
                    {participants !== null ? ` (${String(participants.length)})` : ''}
                </button>
                {open && (
                    <button
                        type="button"
                        onClick={() => {
                            void load()
                        }}
                        className="cursor-pointer text-xs text-neutral-500 hover:underline"
                    >
                        Обновить
                    </button>
                )}
            </div>
            {open && (
                <div className="mt-1">
                    {loading && <p className="text-xs text-neutral-500">Загрузка…</p>}
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    {participants !== null && participants.length === 0 && !loading && (
                        <p className="text-xs text-neutral-400">Пока никто не участвует.</p>
                    )}
                    {participants !== null && participants.length > 0 && (
                        <ul className="flex flex-col gap-1">
                            {participants.map((p) => (
                                <li
                                    key={p.telegram_user_id}
                                    className="flex items-center gap-2 text-xs text-neutral-700"
                                >
                                    {p.avatar_url ? (
                                        <img
                                            src={p.avatar_url}
                                            alt=""
                                            className="h-5 w-5 rounded-full object-cover"
                                            aria-hidden
                                        />
                                    ) : (
                                        <span
                                            className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[10px] text-neutral-600"
                                            aria-hidden
                                        >
                                            {participantName(p).slice(0, 1).toUpperCase()}
                                        </span>
                                    )}
                                    {hasRealName(p) && <span>{participantName(p)}</span>}
                                    {p.username ? (
                                        <a
                                            href={`https://t.me/${p.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="cursor-pointer text-blue-700 hover:underline"
                                        >
                                            @{p.username}
                                        </a>
                                    ) : (
                                        !hasRealName(p) && <span>{participantName(p)}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

function toDatetimeLocal(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultNewDate(): string {
    const d = new Date()
    d.setHours(21, 0, 0, 0)
    return toDatetimeLocal(d.toISOString())
}

interface DateRowProps {
    date: AdminEventDate
    busy: boolean
    nowTs: number
    announced: boolean
    onSave: (id: string, patch: { starts_at: string; note: string | null; cancelled: boolean }) => Promise<void>
    onDelete: (id: string) => Promise<void>
    /** Открыть модалку Telegram: отправка (если ещё не анонсировано) или управление отправленным. */
    onTelegram: (date: AdminEventDate) => void
}

/** Строка даты: просмотр и встроенное редактирование (время, заметка, отмена). */
function DateRow({ date, busy, nowTs, announced, onSave, onDelete, onTelegram }: DateRowProps) {
    const [editing, setEditing] = useState(false)
    const [editAt, setEditAt] = useState(() => toDatetimeLocal(date.starts_at))
    const [editNote, setEditNote] = useState(date.note ?? '')
    const [editCancelled, setEditCancelled] = useState(date.cancelled)

    const startEditing = () => {
        setEditAt(toDatetimeLocal(date.starts_at))
        setEditNote(date.note ?? '')
        setEditCancelled(date.cancelled)
        setEditing(true)
    }

    const save = async () => {
        const iso = new Date(editAt).toISOString()
        if (Number.isNaN(new Date(iso).getTime())) return
        await onSave(date.id, { starts_at: iso, note: editNote.trim() || null, cancelled: editCancelled })
        setEditing(false)
    }

    if (editing) {
        return (
            <li className="flex flex-wrap items-end gap-2 py-2 text-sm">
                <input
                    type="datetime-local"
                    value={editAt}
                    onChange={(e) => {
                        setEditAt(e.target.value)
                    }}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
                <input
                    value={editNote}
                    onChange={(e) => {
                        setEditNote(e.target.value)
                    }}
                    placeholder="Заметка"
                    className="min-w-32 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-1.5 text-neutral-700">
                    <input
                        type="checkbox"
                        checked={editCancelled}
                        onChange={(e) => {
                            setEditCancelled(e.target.checked)
                        }}
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                    />
                    Отменено
                </label>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        void save()
                    }}
                    className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                    Сохранить
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        setEditing(false)
                    }}
                    className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
                >
                    Отмена
                </button>
            </li>
        )
    }

    const d = new Date(date.starts_at)
    const isPast = !Number.isNaN(d.getTime()) && d.getTime() < nowTs
    const canAnnounce = !date.cancelled && !isPast
    return (
        <li className="py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
                <div className={date.cancelled || isPast ? 'text-neutral-400' : 'text-neutral-800'}>
                    <span className={`font-medium ${date.cancelled ? 'line-through' : ''}`}>{formatDate(d)}</span>
                    <span className="ml-2">{formatTime(d)}</span>
                    {date.note && <span className="ml-2 text-neutral-500">— {date.note}</span>}
                    {date.cancelled && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">Отменено</span>
                    )}
                    {announced && !date.cancelled && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Отправлено</span>
                    )}
                    {!date.cancelled && isPast && <span className="ml-2 text-xs text-neutral-400">(прошла)</span>}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                    {/* Telegram: одна кнопка — отправка или управление отправленным анонсом. */}
                    {(canAnnounce || (announced && !date.cancelled)) && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                onTelegram(date)
                            }}
                            className="cursor-pointer rounded-lg border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                            {announced ? 'Анонс в Telegram' : 'Сообщить в Telegram'}
                        </button>
                    )}
                    {/* Действия над самой датой. */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={startEditing}
                            className="cursor-pointer rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
                        >
                            Изменить
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                void onDelete(date.id)
                            }}
                            className="cursor-pointer rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                            Удалить
                        </button>
                    </div>
                </div>
            </div>
            {announced && <ParticipantsBlock eventDateId={date.id} />}
        </li>
    )
}

/** Управление списком дат события: добавление, редактирование (время/заметка/отмена), удаление, анонс в Telegram. */
export function EventDatesManager({ event }: EventDatesManagerProps) {
    const eventId = event.id
    const [dates, setDates] = useState<AdminEventDate[]>([])
    const [announcedDateIds, setAnnouncedDateIds] = useState<Set<string>>(new Set())
    // Сырое тело последнего живого анонса по дате — чтобы при правке показать актуальный текст.
    const [liveBodyByDateId, setLiveBodyByDateId] = useState<Map<string, string>>(new Map())
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newDate, setNewDate] = useState(defaultNewDate)
    const [newNote, setNewNote] = useState('')
    const [announce, setAnnounce] = useState<{
        date: AdminEventDate
        mode: 'send' | 'edit'
        initialBody?: string
    } | null>(null)
    // Снимок «сейчас» на момент рендера — чтобы пометить прошедшие даты без вызова Date.now() в JSX.
    const [nowTs] = useState(() => Date.now())

    const reload = useCallback(async () => {
        setLoading(true)
        try {
            const loaded = await listEventDates(eventId)
            setDates(loaded)
            // Один запрос на все даты (без N+1). «Анонсирована» = есть ЖИВОЕ сообщение
            // (sent, не отменено, не удалено). Если все сообщения удалены — дата снова
            // считается неанонсированной: бейдж «Отправлено» уходит, кнопка → «Сообщить».
            const anns = await listEventAnnouncementsForDates(loaded.map((d) => d.id))
            const announced = new Set<string>()
            const liveBody = new Map<string, string>()
            // anns отсортированы по created_at desc → первое живое по дате = последнее отправленное.
            for (const a of anns) {
                const isLive = a.sent_at !== null && a.cancelled_at === null && a.deleted_at === null
                if (!isLive) continue
                announced.add(a.event_date_id)
                if (!liveBody.has(a.event_date_id)) liveBody.set(a.event_date_id, a.body_text)
            }
            setAnnouncedDateIds(announced)
            setLiveBodyByDateId(liveBody)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [eventId])

    useEffect(() => {
        void Promise.resolve().then(() => reload())
    }, [reload])

    const handleAdd = async () => {
        const iso = new Date(newDate).toISOString()
        if (Number.isNaN(new Date(iso).getTime())) {
            setError('Укажите корректную дату и время.')
            return
        }
        setBusy(true)
        setError(null)
        try {
            await addEventDate(eventId, { starts_at: iso, note: newNote.trim() || null })
            setNewNote('')
            await reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    const handleAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            if (!busy) void handleAdd()
        }
    }

    const handleSave = async (id: string, patch: { starts_at: string; note: string | null; cancelled: boolean }) => {
        setBusy(true)
        setError(null)
        // Отмена даты, у которой были отправлены анонсы → авто-отмена сообщений в Telegram.
        const wasAnnounced = announcedDateIds.has(id)
        const becomingCancelled = patch.cancelled && !dates.find((d) => d.id === id)?.cancelled
        try {
            await updateEventDate(id, patch)
            if (becomingCancelled && wasAnnounced) {
                try {
                    await cancelEventDateAnnouncements(id)
                } catch (err) {
                    // Best-effort: отмену даты не откатываем, но сообщаем об ошибке.
                    setError(
                        `Дата отменена, но не удалось отменить анонсы: ${err instanceof Error ? err.message : String(err)}`,
                    )
                }
            }
            await reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    const handleDelete = async (id: string) => {
        setBusy(true)
        setError(null)
        try {
            await deleteEventDate(id)
            await reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">Даты проведения</h2>
            <p className="mt-1 text-xs text-neutral-500">
                Одна дата — разовое событие, несколько — повторяющееся. Дату можно изменить или отменить разово.
            </p>

            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {loading && <p className="mt-3 text-sm text-neutral-500">Загрузка…</p>}

            {!loading && (
                <ul className="mt-3 divide-y divide-neutral-100">
                    {dates.map((d) => (
                        <DateRow
                            key={d.id}
                            date={d}
                            busy={busy}
                            nowTs={nowTs}
                            announced={announcedDateIds.has(d.id)}
                            onSave={handleSave}
                            onDelete={handleDelete}
                            onTelegram={(date) => {
                                // Анонсировано → режим управления (правка/удаление); иначе — отправка.
                                setAnnounce(
                                    announcedDateIds.has(date.id)
                                        ? { date, mode: 'edit', initialBody: liveBodyByDateId.get(date.id) }
                                        : { date, mode: 'send' },
                                )
                            }}
                        />
                    ))}
                    {dates.length === 0 && <li className="py-2 text-sm text-neutral-400">Дат пока нет.</li>}
                </ul>
            )}

            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Новая дата и время</label>
                    <input
                        type="datetime-local"
                        value={newDate}
                        onChange={(e) => {
                            setNewDate(e.target.value)
                        }}
                        onKeyDown={handleAddKeyDown}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
                <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Заметка (необязательно)</label>
                    <input
                        value={newNote}
                        onChange={(e) => {
                            setNewNote(e.target.value)
                        }}
                        onKeyDown={handleAddKeyDown}
                        placeholder="Например, езда спиной вперёд"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        void handleAdd()
                    }}
                    className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                    Добавить дату
                </button>
            </div>

            {announce && (
                <EventAnnounceModal
                    event={event}
                    date={announce.date}
                    mode={announce.mode}
                    initialBody={announce.initialBody}
                    onClose={() => {
                        setAnnounce(null)
                    }}
                    onSent={() => {
                        setAnnounce(null)
                        void reload()
                    }}
                />
            )}
        </div>
    )
}
