import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import {
    addEventDate,
    deleteEventDate,
    listEventDates,
    updateEventDate,
    type AdminEventDate,
} from '@/admin/lib/adminApi'
import { formatDate, formatTime } from '@/utils/eventSchedule'

interface EventDatesManagerProps {
    eventId: number
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
    onSave: (id: string, patch: { starts_at: string; note: string | null; cancelled: boolean }) => Promise<void>
    onDelete: (id: string) => Promise<void>
}

/** Строка даты: просмотр и встроенное редактирование (время, заметка, отмена). */
function DateRow({ date, busy, nowTs, onSave, onDelete }: DateRowProps) {
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
                    onChange={(e) => { setEditAt(e.target.value); }}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
                <input
                    value={editNote}
                    onChange={(e) => { setEditNote(e.target.value); }}
                    placeholder="Заметка"
                    className="min-w-32 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-1.5 text-neutral-700">
                    <input
                        type="checkbox"
                        checked={editCancelled}
                        onChange={(e) => { setEditCancelled(e.target.checked); }}
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                    />
                    Отменено
                </label>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => { void save(); }}
                    className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                    Сохранить
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => { setEditing(false); }}
                    className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
                >
                    Отмена
                </button>
            </li>
        )
    }

    const d = new Date(date.starts_at)
    const isPast = !Number.isNaN(d.getTime()) && d.getTime() < nowTs
    return (
        <li className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className={date.cancelled || isPast ? 'text-neutral-400' : 'text-neutral-800'}>
                <span className={`font-medium ${date.cancelled ? 'line-through' : ''}`}>{formatDate(d)}</span>
                <span className="ml-2">{formatTime(d)}</span>
                {date.note && <span className="ml-2 text-neutral-500">— {date.note}</span>}
                {date.cancelled && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">Отменено</span>
                )}
                {!date.cancelled && isPast && <span className="ml-2 text-xs text-neutral-400">(прошла)</span>}
            </div>
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
                    onClick={() => { void onDelete(date.id); }}
                    className="cursor-pointer rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                    Удалить
                </button>
            </div>
        </li>
    )
}

/** Управление списком дат события: добавление, редактирование (время/заметка/отмена), удаление. */
export function EventDatesManager({ eventId }: EventDatesManagerProps) {
    const [dates, setDates] = useState<AdminEventDate[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newDate, setNewDate] = useState(defaultNewDate)
    const [newNote, setNewNote] = useState('')
    // Снимок «сейчас» на момент рендера — чтобы пометить прошедшие даты без вызова Date.now() в JSX.
    const [nowTs] = useState(() => Date.now())

    const reload = useCallback(async () => {
        setLoading(true)
        try {
            setDates(await listEventDates(eventId))
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
        try {
            await updateEventDate(id, patch)
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
                            onSave={handleSave}
                            onDelete={handleDelete}
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
                        onChange={(e) => { setNewDate(e.target.value); }}
                        onKeyDown={handleAddKeyDown}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
                <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Заметка (необязательно)</label>
                    <input
                        value={newNote}
                        onChange={(e) => { setNewNote(e.target.value); }}
                        onKeyDown={handleAddKeyDown}
                        placeholder="Например, езда спиной вперёд"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => { void handleAdd(); }}
                    className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                    Добавить дату
                </button>
            </div>
        </div>
    )
}
