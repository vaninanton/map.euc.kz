import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listEvents, toggleEventDisabled, type AdminEventListItem } from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'
import {
    compareEventsForList,
    EVENT_LIST_FILTERS,
    matchesEventFilter,
    matchesEventQuery,
    summarizeEventDates,
    type EventDatesSummary,
    type EventListFilter,
} from '@/admin/utils/eventDates'
import { FilterChips } from '@/components/ui/FilterChips'
import { SearchInput } from '@/components/ui/SearchInput'
import { formatDate, formatTime } from '@/utils/eventSchedule'
import { EVENT_TYPE_LABELS } from '@/constants'
import type { AdminEventDate } from '@/admin/lib/adminApi'

interface EventRow {
    event: AdminEventListItem
    summary: EventDatesSummary<AdminEventDate>
}

/** Ячейка «Ближайшая дата»: будущая дата, последняя прошедшая либо явное «нет даты». */
function DateCell({ summary }: { summary: EventDatesSummary<AdminEventDate> }) {
    if (summary.status === 'none') {
        return (
            <span className="text-amber-700" title="У события нет активных дат — оно не попадёт в ленту">
                нет даты
            </span>
        )
    }

    const date = summary.next ?? summary.lastPast
    if (!date) return <span className="text-neutral-400">—</span>

    const parsed = new Date(date.starts_at)
    const isPast = summary.status === 'past'
    return (
        <span className={isPast ? 'text-neutral-400' : 'text-neutral-800'}>
            <span className="font-medium">{formatDate(parsed)}</span>
            <span className="ml-1.5">{formatTime(parsed)}</span>
            {date.note && <span className="ml-1.5 text-neutral-500">— {date.note}</span>}
        </span>
    )
}

/** Счётчик дат: сколько будущих из скольких всего, плюс отметка об отменённых. */
function DatesCountCell({ summary }: { summary: EventDatesSummary<AdminEventDate> }) {
    if (summary.totalCount === 0) return <span className="text-neutral-400">—</span>
    return (
        <span className="text-neutral-600">
            {summary.upcomingCount > 0 && <span className="font-medium text-neutral-800">{summary.upcomingCount}</span>}
            {summary.upcomingCount > 0 && ' из '}
            {summary.totalCount}
            {summary.cancelledCount > 0 && (
                <span className="ml-1 text-neutral-400">({summary.cancelledCount} отм.)</span>
            )}
        </span>
    )
}

export function EventsPage() {
    const navigate = useNavigate()
    const [busyId, setBusyId] = useState<number | null>(null)
    const [toggleError, setToggleError] = useState<string | null>(null)
    const [filter, setFilter] = useState<EventListFilter>('upcoming')
    const [query, setQuery] = useState('')
    // Снимок «сейчас» на момент монтирования — чтобы делить даты на прошедшие и будущие без Date.now() в рендере.
    const [nowTs] = useState(() => Date.now())

    const load = useCallback(() => listEvents(), [])
    const { items, loading, error, reload } = useAdminListLoader(load)

    // Сводка по датам + поиск считаются один раз на список, фильтр по статусу — поверх них,
    // чтобы счётчики во вкладках учитывали поисковый запрос.
    const searched: EventRow[] = useMemo(() => {
        const now = new Date(nowTs)
        return items
            .filter((event) => matchesEventQuery(event.title, query))
            .map((event) => ({ event, summary: summarizeEventDates(event.dates, now) }))
    }, [items, query, nowTs])

    const visible: EventRow[] = useMemo(
        () =>
            searched
                .filter((row) => matchesEventFilter(row.summary.status, filter))
                .sort((a, b) =>
                    compareEventsForList(
                        {
                            status: a.summary.status,
                            nextAt: a.summary.next?.starts_at ?? null,
                            lastPastAt: a.summary.lastPast?.starts_at ?? null,
                            createdAt: a.event.created_at,
                        },
                        {
                            status: b.summary.status,
                            nextAt: b.summary.next?.starts_at ?? null,
                            lastPastAt: b.summary.lastPast?.starts_at ?? null,
                            createdAt: b.event.created_at,
                        },
                    ),
                ),
        [searched, filter],
    )

    const filterOptions = useMemo(
        () =>
            EVENT_LIST_FILTERS.map(([value, label]) => {
                const count = searched.filter((row) => matchesEventFilter(row.summary.status, value)).length
                return [value, `${label} (${String(count)})`] as const
            }),
        [searched],
    )

    const handleToggle = async (event: AdminEventListItem) => {
        setBusyId(event.id)
        setToggleError(null)
        try {
            await toggleEventDisabled(event.id, !event.flag_disabled)
            await reload()
        } catch (err) {
            setToggleError(err instanceof Error ? err.message : String(err))
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
                        Покатушки, мероприятия и обучение. Событие создаётся сразу с датой, остальные даты и повторы —
                        внутри события.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            void reload()
                        }}
                        className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                    >
                        Обновить
                    </button>
                    <Link
                        to="new"
                        className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Создать
                    </Link>
                </div>
            </header>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <FilterChips
                    options={filterOptions}
                    value={filter}
                    onChange={setFilter}
                    activeClass="bg-blue-600 text-white"
                />
                <div className="w-full max-w-xs">
                    <SearchInput value={query} onChange={setQuery} placeholder="Поиск по названию…" />
                </div>
            </div>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {toggleError && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{toggleError}</div>
            )}

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                            <th className="px-3 py-2 font-medium">Тип</th>
                            <th className="px-3 py-2 font-medium">Название</th>
                            <th className="px-3 py-2 font-medium">Ближайшая дата</th>
                            <th className="px-3 py-2 font-medium">Даты</th>
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
                                <td colSpan={5} className="px-3 py-8 text-center">
                                    <p className="text-neutral-500">Событий пока нет.</p>
                                    <Link
                                        to="new"
                                        className="mt-2 inline-block cursor-pointer text-sm font-medium text-blue-700 hover:underline"
                                    >
                                        Создать первое событие
                                    </Link>
                                </td>
                            </tr>
                        )}
                        {!loading && items.length > 0 && visible.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                                    Ничего не найдено — измените фильтр или запрос.
                                </td>
                            </tr>
                        )}
                        {visible.map(({ event, summary }) => (
                            <tr
                                key={event.id}
                                onClick={() => {
                                    void navigate(`/admin/event/${String(event.id)}`)
                                }}
                                className="cursor-pointer hover:bg-neutral-50"
                            >
                                <td className="px-3 py-2 text-neutral-600">{EVENT_TYPE_LABELS[event.type]}</td>
                                <td className="px-3 py-2 font-medium">{event.title}</td>
                                <td className="px-3 py-2">
                                    <DateCell summary={summary} />
                                </td>
                                <td className="px-3 py-2">
                                    <DatesCountCell summary={summary} />
                                </td>
                                <td className="px-3 py-2">
                                    <button
                                        type="button"
                                        disabled={busyId === event.id}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            void handleToggle(event)
                                        }}
                                        className={[
                                            'cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
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
