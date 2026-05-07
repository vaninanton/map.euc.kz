import { useCallback, useState } from 'react'
import {
    approveSubmission,
    listSubmissions,
    rejectSubmission,
    type SubmissionStatus,
} from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'
import { formatAdminDate } from '@/admin/utils/formatAdminDate'

const STATUS_FILTERS: Array<{ value: SubmissionStatus | 'all'; label: string }> = [
    { value: 'pending', label: 'На модерации' },
    { value: 'approved', label: 'Одобрены' },
    { value: 'rejected', label: 'Отклонены' },
    { value: 'all', label: 'Все' },
]

const STATUS_LABEL: Record<SubmissionStatus, string> = {
    pending: 'На модерации',
    approved: 'Одобрена',
    rejected: 'Отклонена',
}

const STATUS_BADGE: Record<SubmissionStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-rose-100 text-rose-800',
}

export function SubmissionsPage() {
    const [filter, setFilter] = useState<SubmissionStatus | 'all'>('pending')
    const [busyId, setBusyId] = useState<string | null>(null)

    const load = useCallback(
        () => listSubmissions(filter === 'all' ? undefined : filter),
        [filter],
    )
    const { items, loading, error, reload } = useAdminListLoader(load)

    const handleApprove = async (id: string) => {
        if (!window.confirm('Одобрить заявку и опубликовать точку?')) return
        setBusyId(id)
        try {
            await approveSubmission(id)
            await reload()
        } catch (err) {
            window.alert(err instanceof Error ? err.message : String(err))
        } finally {
            setBusyId(null)
        }
    }

    const handleReject = async (id: string) => {
        if (!window.confirm('Отклонить заявку?')) return
        setBusyId(id)
        try {
            await rejectSubmission(id)
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
                    <h1 className="text-xl font-semibold">Заявки на точки</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Очередь модерации публичных предложений из формы добавления точки.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filter}
                        onChange={(event) => {
                            setFilter(event.target.value as SubmissionStatus | 'all')
                        }}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    >
                        {STATUS_FILTERS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => {
                            void reload()
                        }}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                    >
                        Обновить
                    </button>
                </div>
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                            <th className="px-3 py-2 font-medium">Создано</th>
                            <th className="px-3 py-2 font-medium">Тип</th>
                            <th className="px-3 py-2 font-medium">Название</th>
                            <th className="px-3 py-2 font-medium">Координаты</th>
                            <th className="px-3 py-2 font-medium">Статус</th>
                            <th className="px-3 py-2 font-medium" />
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
                                    Заявок нет.
                                </td>
                            </tr>
                        )}
                        {items.map((sub) => (
                            <tr key={sub.id}>
                                <td className="px-3 py-2 text-neutral-600">{formatAdminDate(sub.created_at)}</td>
                                <td className="px-3 py-2">
                                    {sub.type === 'socket' ? 'Розетка' : 'Точка'}
                                    {sub.flag_is_meeting && ' · встреча'}
                                </td>
                                <td className="px-3 py-2">
                                    <div className="font-medium">{sub.title}</div>
                                    {sub.description && (
                                        <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                                            {sub.description}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                                    {sub.coordinates[0].toFixed(5)}, {sub.coordinates[1].toFixed(5)}
                                </td>
                                <td className="px-3 py-2">
                                    <span
                                        className={[
                                            'rounded-full px-2 py-0.5 text-xs font-medium',
                                            STATUS_BADGE[sub.status],
                                        ].join(' ')}
                                    >
                                        {STATUS_LABEL[sub.status]}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {sub.status === 'pending' ? (
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                disabled={busyId === sub.id}
                                                onClick={() => {
                                                    void handleApprove(sub.id)
                                                }}
                                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                Одобрить
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busyId === sub.id}
                                                onClick={() => {
                                                    void handleReject(sub.id)
                                                }}
                                                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                                            >
                                                Отклонить
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-neutral-400">
                                            {sub.processed_at ? formatAdminDate(sub.processed_at) : '—'}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
