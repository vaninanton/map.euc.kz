import { useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons'
import type { EventRow } from '@/types'
import { EVENT_TYPE_LABELS } from '@/constants'
import { formatOccurrenceLabel, summarizeEvent } from '@/utils/eventSchedule'

interface PointEventsBlockProps {
    events: EventRow[]
    onOpenEvents?: () => void
}

/** Блок «События здесь» на карточке точки: события, где точка — старт или финиш. */
export function PointEventsBlock({ events, onOpenEvents }: PointEventsBlockProps) {
    const items = useMemo(
        () => events.map((event) => ({ event, summary: summarizeEvent(event) })),
        [events],
    )
    return (
        <div className="mt-3 border-t border-neutral-100 pt-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                <FontAwesomeIcon icon={faCalendarDays} className="text-[#f25824]" aria-hidden />
                События здесь
            </div>
            <ul className="space-y-1.5">
                {items.map(({ event, summary }) => (
                        <li key={event.id}>
                            <button
                                type="button"
                                onClick={onOpenEvents}
                                className="w-full cursor-pointer rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-neutral-50"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="rounded-full bg-[#f25824]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#f25824]">
                                        {EVENT_TYPE_LABELS[event.type]}
                                    </span>
                                    <span className="truncate text-[13px] font-medium text-neutral-900">{event.title}</span>
                                    {summary.ongoing && (
                                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
                                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
                                            Сейчас
                                        </span>
                                    )}
                                </div>
                                {summary.next && (
                                    <div className="mt-0.5 text-[11px] text-neutral-500">
                                        {summary.ongoing ? 'Следующее' : 'Ближайшее'}: {formatOccurrenceLabel(summary.next.start, undefined, event.duration_minutes)}
                                    </div>
                                )}
                            </button>
                        </li>
                ))}
            </ul>
        </div>
    )
}
