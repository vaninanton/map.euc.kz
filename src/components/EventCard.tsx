import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDay, faClock, faLocationDot } from '@fortawesome/free-solid-svg-icons'
import type { EventRow } from '@/types'
import { EVENT_TYPE_LABELS } from '@/constants'
import { buildEventDetailPath } from '@/utils/eventLinks'
import { applyTypography } from '@/utils/typograf'
import { formatOccurrenceLabel, summarizeEvent } from '@/utils/eventSchedule'

interface EventCardProps {
    event: EventRow
}

/** Карточка-превью события в ленте: фото, тип, расписание, место. Ведёт на страницу события. */
export function EventCard({ event }: EventCardProps) {
    // Если у старта есть и точка, и текстовое место — отдельной строкой место не дублируем.
    const startLabelOverride = event.start_point ? event.location_text : null
    // Сводка расписания — один проход по датам события.
    const { next, ongoing, schedule } = useMemo(() => summarizeEvent(event), [event])
    const typeLabel = EVENT_TYPE_LABELS[event.type]

    return (
        <Link
            to={buildEventDetailPath(event.id)}
            className="block cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-colors hover:border-[#f25824]/40 hover:bg-neutral-50"
        >
            {event.photo_url && (
                <img src={event.photo_url} alt={event.title} className="h-40 w-full object-cover" loading="lazy" />
            )}
            <div className="p-4">
                <span className="inline-flex items-center rounded-full bg-[#f25824]/10 px-2.5 py-0.5 text-xs font-semibold text-[#f25824]">
                    {typeLabel}
                </span>
                <h3 className="mt-2 text-base font-semibold text-neutral-900">{event.title}</h3>

                {event.description && (
                    <p
                        className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm text-neutral-600"
                        dangerouslySetInnerHTML={{ __html: applyTypography(event.description) }}
                    />
                )}

                <div className="mt-3 space-y-1.5 text-sm text-neutral-700">
                    {ongoing ? (
                        <div className="flex items-center gap-2 font-semibold text-green-700">
                            <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
                                <span className="absolute inset-0 rounded-full bg-green-500 animate-live-ping" />
                                <span className="relative inline-block h-2 w-2 rounded-full bg-green-500" />
                            </span>
                            <span>Сейчас</span>
                        </div>
                    ) : (
                        <div
                            className={`flex items-center gap-2 ${next ? 'font-medium text-neutral-900' : 'text-neutral-400'}`}
                        >
                            <FontAwesomeIcon
                                icon={next ? faCalendarDay : faClock}
                                className={`w-4 ${next ? 'text-[#f25824]' : 'text-neutral-400'}`}
                                aria-hidden
                            />
                            <span>{schedule}</span>
                        </div>
                    )}
                    {ongoing && next && (
                        <div className="flex items-center gap-2 font-medium text-neutral-900">
                            <FontAwesomeIcon icon={faCalendarDay} className="w-4 text-[#f25824]" aria-hidden />
                            <span>
                                Следующее: {formatOccurrenceLabel(next.start, undefined, event.duration_minutes)}
                            </span>
                        </div>
                    )}
                    {event.location_text && !startLabelOverride && (
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faLocationDot} className="w-4 text-neutral-400" aria-hidden />
                            <span>{event.location_text}</span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    )
}
