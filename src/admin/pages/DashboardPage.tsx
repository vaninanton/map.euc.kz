import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats, listRoutes, type AdminDashboardStats } from '@/admin/lib/adminApi'
import { totalRoutesDistanceKm } from '@/admin/utils/routeDistance'
import { formatAdminDate } from '@/admin/utils/formatAdminDate'
import { formatAgo, isBotStale } from '@/admin/utils/adminTime'

interface StatCardProps {
    label: string
    value: string
    hint?: string
    to?: string
}

function StatCard({ label, value, hint, to }: StatCardProps) {
    const body = (
        <>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
            {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
        </>
    )
    const className = 'rounded-xl border border-neutral-200 bg-white px-4 py-3'
    if (to) {
        return (
            <Link
                to={to}
                className={`${className} block cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/40`}
            >
                {body}
            </Link>
        )
    }
    return <div className={className}>{body}</div>
}

interface ActivitySparklineProps {
    activity: AdminDashboardStats['daily_activity']
}

/** Столбиковый мини-график уникальных райдеров по дням (30 дней). */
function ActivitySparkline({ activity }: ActivitySparklineProps) {
    if (activity.length === 0) {
        return <p className="text-sm text-neutral-500">Нет активности за последние 30 дней.</p>
    }
    const max = Math.max(...activity.map((d) => d.riders), 1)
    return (
        <div className="flex h-24 items-end gap-1" role="img" aria-label="Активность райдеров по дням за 30 дней">
            {activity.map((d) => (
                <div
                    key={d.day}
                    className="min-w-1 flex-1 rounded-t bg-blue-500/80"
                    style={{ height: `${String(Math.max(4, Math.round((d.riders / max) * 100)))}%` }}
                    title={`${d.day}: райдеров ${String(d.riders)}, локаций ${String(d.locations)}`}
                />
            ))}
        </div>
    )
}

export function DashboardPage() {
    const [stats, setStats] = useState<AdminDashboardStats | null>(null)
    const [routesKm, setRoutesKm] = useState<number | null>(null)
    const [botLooksDead, setBotLooksDead] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError(null)
            const [statsResult, routesResult] = await Promise.allSettled([getDashboardStats(), listRoutes()])
            if (cancelled) return
            if (statsResult.status === 'fulfilled') {
                setStats(statsResult.value)
                setBotLooksDead(isBotStale(statsResult.value.last_location_at))
            } else {
                const reason: unknown = statsResult.reason
                setError(reason instanceof Error ? reason.message : String(reason))
            }
            // Километраж — best-effort: ошибка списка маршрутов не роняет дашборд
            setRoutesKm(routesResult.status === 'fulfilled' ? totalRoutesDistanceKm(routesResult.value) : null)
            setLoading(false)
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [])

    if (loading) {
        return <div className="text-sm text-neutral-500">Загрузка…</div>
    }

    if (error || !stats) {
        return (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Не удалось загрузить статистику{error ? `: ${error}` : ''}
            </div>
        )
    }

    return (
        <section>
            <header className="mb-4">
                <h1 className="text-xl font-semibold">Дашборд</h1>
                <p className="mt-1 text-sm text-neutral-600">Состояние карты, райдеров и рассылок одним взглядом.</p>
            </header>

            {(stats.submissions_pending > 0 || stats.outbound_errors_30d > 0 || botLooksDead) && (
                <div className="mb-4 flex flex-col gap-2">
                    {stats.submissions_pending > 0 && (
                        <Link
                            to="/admin/submissions"
                            className="cursor-pointer rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                        >
                            Заявок на модерации: {stats.submissions_pending} — перейти к заявкам
                        </Link>
                    )}
                    {stats.outbound_errors_30d > 0 && (
                        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            Ошибок отправки в Telegram за 30 дней: {stats.outbound_errors_30d}
                        </div>
                    )}
                    {botLooksDead && (
                        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            Бот давно не принимал геопозиции
                            {stats.last_location_at
                                ? ` (последняя — ${formatAgo(stats.last_location_at)})`
                                : ' (записей нет)'}
                            . Проверьте webhook.
                        </div>
                    )}
                </div>
            )}

            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Райдеры</h2>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Сегодня" value={String(stats.riders.today)} />
                <StatCard label="7 дней" value={String(stats.riders.week)} />
                <StatCard label="30 дней" value={String(stats.riders.month)} />
                <StatCard label="Год" value={String(stats.riders.year)} />
            </div>
            <div className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Уникальные райдеры по дням (30 дней)
                    </p>
                    <p className="text-xs text-neutral-500">
                        {stats.last_location_at
                            ? `Последняя геопозиция: ${formatAgo(stats.last_location_at)}`
                            : 'Геопозиций ещё не было'}
                    </p>
                </div>
                <ActivitySparkline activity={stats.daily_activity} />
            </div>

            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Контент</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard
                    label="Точки"
                    value={String(stats.points.total)}
                    hint={`розеток: ${String(stats.points.sockets)} · встреч: ${String(stats.points.meetings)} · скрыто: ${String(stats.points.disabled)}`}
                    to="/admin/point"
                />
                <StatCard
                    label="Маршруты"
                    value={String(stats.routes.total)}
                    hint={
                        routesKm !== null
                            ? `${routesKm.toFixed(1)} км суммарно · скрыто: ${String(stats.routes.disabled)}`
                            : `скрыто: ${String(stats.routes.disabled)}`
                    }
                    to="/admin/route"
                />
                <StatCard label="Фото точек" value={String(stats.photos_total)} />
                <StatCard
                    label="События"
                    value={String(stats.events.total)}
                    hint={
                        `будущих дат: ${String(stats.upcoming_event_dates)}` +
                        (stats.next_event_starts_at
                            ? ` · ближайшее: ${formatAdminDate(stats.next_event_starts_at)}`
                            : '') +
                        ` · RSVP: ${String(stats.participants_total)}`
                    }
                    to="/admin/event"
                />
                <StatCard label="Новости" value={String(stats.news_total)} to="/admin/news" />
                <StatCard
                    label="Чаты рассылки"
                    value={String(stats.chats_enabled)}
                    hint="включённых назначений"
                    to="/admin/telegram-chats"
                />
            </div>
        </section>
    )
}
