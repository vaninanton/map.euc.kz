import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listEvents, toggleEventDisabled, type AdminEvent } from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'
import { formatAdminDate } from '@/admin/utils/formatAdminDate'
import { EVENT_TYPE_LABELS } from '@/constants'

export function EventsPage() {
    const navigate = useNavigate()
    const [busyId, setBusyId] = useState<number | null>(null)

    const load = useCallback(() => listEvents(), [])
    const { items, loading, error, reload } = useAdminListLoader(load)

    const handleToggle = async (event: AdminEvent) => {
        setBusyId(event.id)
        try {
            await toggleEventDisabled(event.id, !event.flag_disabled)
            await reload()
        } catch (err) {
            window.alert(err instanceof Error ? err.message : String(err))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <section>
            <header className="mb-4 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold">События</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Покатушки, мероприятия и обучение. Даты задаются списком, плюс фото, старт и финиш.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            void reload()
                        }}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                    >
                        Обновить
                    </button>
                    <Link
                        to="new"
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Создать
                    </Link>
                </div>
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                            <th className="px-3 py-2 font-medium">ID</th>
                            <th className="px-3 py-2 font-medium">Тип</th>
                            <th className="px-3 py-2 font-medium">Название</th>
                            <th className="px-3 py-2 font-medium">Создано</th>
                            <th className="px-3 py-2 font-medium">Видно</th>
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
                                    Событий пока нет.
                                </td>
                            </tr>
                        )}
                        {items.map((event) => (
                            <tr
                                key={event.id}
                                onClick={() => {
                                    void navigate(`/admin/event/${String(event.id)}`)
                                }}
                                className="cursor-pointer hover:bg-neutral-50"
                            >
                                <td className="px-3 py-2 font-mono text-xs text-neutral-500">{event.id}</td>
                                <td className="px-3 py-2">{EVENT_TYPE_LABELS[event.type]}</td>
                                <td className="px-3 py-2 font-medium">{event.title}</td>
                                <td className="px-3 py-2 text-neutral-600">{formatAdminDate(event.created_at)}</td>
                                <td className="px-3 py-2">
                                    <button
                                        type="button"
                                        disabled={busyId === event.id}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            void handleToggle(event)
                                        }}
                                        className={[
                                            'rounded-full px-2 py-0.5 text-xs font-medium transition disabled:opacity-50',
                                            event.flag_disabled
                                                ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
                                        ].join(' ')}
                                    >
                                        {event.flag_disabled ? 'скрыто' : 'видно'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
