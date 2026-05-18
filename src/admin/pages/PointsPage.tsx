import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    listPoints,
    togglePointDisabled,
    type AdminMapPoint,
} from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'
import { formatAdminDate } from '@/admin/utils/formatAdminDate'

export function PointsPage() {
    const navigate = useNavigate()
    const [busyId, setBusyId] = useState<number | null>(null)

    const load = useCallback(() => listPoints(), [])
    const { items, loading, error, reload } = useAdminListLoader(load)

    const handleToggle = async (point: AdminMapPoint) => {
        setBusyId(point.id)
        try {
            await togglePointDisabled(point.id, !point.flag_disabled)
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
                    <h1 className="text-xl font-semibold">Точки</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Управление публичными точками и розетками. Скрытие через флаг disabled, физическое удаление
                        вместе с фото.
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
                            <th className="px-3 py-2 font-medium">Координаты</th>
                            <th className="px-3 py-2 font-medium">Создано</th>
                            <th className="px-3 py-2 font-medium">Видна</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {loading && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                                    Загрузка…
                                </td>
                            </tr>
                        )}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                                    Точек пока нет.
                                </td>
                            </tr>
                        )}
                        {items.map((point) => (
                            <tr
                                key={point.id}
                                onClick={() => {
                                    void navigate(`/admin/point/${String(point.id)}`)
                                }}
                                className="cursor-pointer hover:bg-neutral-50"
                            >
                                <td className="px-3 py-2 font-mono text-xs text-neutral-500">{point.id}</td>
                                <td className="px-3 py-2">
                                    {point.type === 'socket' ? 'Розетка' : 'Точка'}
                                    {point.flag_is_meeting && ' · встреча'}
                                    {point.flag_erlan && ' · ерландия'}
                                </td>
                                <td className="px-3 py-2 font-medium">{point.title}</td>
                                <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                                    {point.coordinates[0].toFixed(5)}, {point.coordinates[1].toFixed(5)}
                                </td>
                                <td className="px-3 py-2 text-neutral-600">{formatAdminDate(point.created_at)}</td>
                                <td className="px-3 py-2">
                                    <button
                                        type="button"
                                        disabled={busyId === point.id}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            void handleToggle(point)
                                        }}
                                        className={[
                                            'rounded-full px-2 py-0.5 text-xs font-medium transition disabled:opacity-50',
                                            point.flag_disabled
                                                ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
                                        ].join(' ')}
                                    >
                                        {point.flag_disabled ? 'скрыта' : 'видна'}
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
