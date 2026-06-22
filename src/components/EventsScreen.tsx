import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { EventRow, EventType } from '@/types'
import { EVENT_TYPE_LABELS } from '@/constants'
import { getNextOccurrence } from '@/utils/eventSchedule'
import { EventCard } from '@/components/EventCard'

interface EventsScreenProps {
    events: EventRow[]
    loading: boolean
    error: string | null
    /** Вызывается при открытии экрана — сбрасывает бейдж непрочитанных. */
    onMarkAsRead: () => void
    onClose: () => void
    onShowOnMap?: (coordinates: [number, number]) => void
}

type TypeFilter = 'all' | EventType

const TYPE_FILTERS: Array<[TypeFilter, string]> = [
    ['all', 'Все'],
    ['group_ride', EVENT_TYPE_LABELS.group_ride],
    ['event', EVENT_TYPE_LABELS.event],
    ['training', EVENT_TYPE_LABELS.training],
]

/** Полноэкранная лента событий сообщества. */
export function EventsScreen({ events, loading, error, onMarkAsRead, onClose, onShowOnMap }: EventsScreenProps) {
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

    // Отмечаем прочитанным один раз при открытии.
    useEffect(() => {
        onMarkAsRead()
    }, [onMarkAsRead])

    const visibleEvents = useMemo(() => {
        const filtered = typeFilter === 'all' ? events : events.filter((e) => e.type === typeFilter)
        // Ключ сортировки считаем один раз на событие; без будущих дат — в конец.
        return filtered
            .map((event) => ({ event, nextTime: getNextOccurrence(event)?.start.getTime() ?? Number.POSITIVE_INFINITY }))
            .sort((a, b) => a.nextTime - b.nextTime)
            .map((x) => x.event)
    }, [events, typeFilter])

    return (
        <div
            className="fixed inset-0 z-30 flex flex-col bg-neutral-50
                pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]"
            role="dialog"
            aria-label="События"
        >
            {/* Шапка */}
            <header
                className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 py-3"
                style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendarDays} className="text-[#f25824]" aria-hidden />
                    <h1 className="text-lg font-semibold text-neutral-900">События</h1>
                    <span className="text-sm font-medium text-neutral-400">{visibleEvents.length}</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="-m-2 cursor-pointer rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Закрыть"
                >
                    <FontAwesomeIcon icon={faXmark} className="h-5 w-5" aria-hidden />
                </button>
            </header>

            {/* Фильтр по типу */}
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-2.5">
                {TYPE_FILTERS.map(([val, label]) => (
                    <button
                        key={val}
                        type="button"
                        onClick={() => { setTypeFilter(val); }}
                        className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                            typeFilter === val
                                ? 'bg-[#f25824] text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Лента */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {error && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}
                {loading && !error && (
                    <div className="py-12 text-center text-sm text-neutral-400">Загрузка событий…</div>
                )}
                {!loading && !error && visibleEvents.length === 0 && (
                    <div className="py-12 text-center text-sm text-neutral-400">Пока нет событий</div>
                )}
                {!error && visibleEvents.length > 0 && (
                    <div className="mx-auto flex max-w-xl flex-col gap-4">
                        {visibleEvents.map((event) => (
                            <EventCard key={event.id} event={event} onShowCoordinates={onShowOnMap} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
