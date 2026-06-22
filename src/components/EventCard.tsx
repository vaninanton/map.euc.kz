import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCalendarDay, faClock, faLocationDot, faFlagCheckered } from '@fortawesome/free-solid-svg-icons'
import type { EventRow, EventLinkedPoint } from '@/types'
import { EVENT_TYPE_LABELS } from '@/constants'
import { buildMapDeepLinkPath } from '@/utils/hashNav'
import { formatOccurrenceLabel, summarizeEvent } from '@/utils/eventSchedule'

interface EventCardProps {
    event: EventRow
    /** Центрировать карту на координатах (для ручных координат старта/финиша). */
    onShowCoordinates?: (coordinates: [number, number]) => void
}

interface EndpointButtonProps {
    icon: IconDefinition
    iconClassName: string
    fallbackLabel: string
    point: EventLinkedPoint | null
    coordinates: [number, number] | null
    /** Переопределяет подпись точки (например, текстовым местом события). */
    labelOverride?: string | null
    onShowCoordinates?: (coordinates: [number, number]) => void
}

/** Кнопка старта/финиша: ссылка на карточку точки либо центрирование по координатам. */
function EndpointButton({
    icon,
    iconClassName,
    fallbackLabel,
    point,
    coordinates,
    labelOverride,
    onShowCoordinates,
}: EndpointButtonProps) {
    const className =
        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50'

    if (point) {
        return (
            <Link to={`/${buildMapDeepLinkPath('point', point.id)}`} className={className}>
                <FontAwesomeIcon icon={icon} className={iconClassName} aria-hidden />
                {labelOverride ?? point.title}
            </Link>
        )
    }
    if (coordinates) {
        return (
            <button type="button" onClick={() => onShowCoordinates?.(coordinates)} className={className}>
                <FontAwesomeIcon icon={icon} className={iconClassName} aria-hidden />
                {fallbackLabel}
            </button>
        )
    }
    return null
}

/** Карточка события в публичной ленте: фото, тип, расписание, ближайшая дата, место. */
export function EventCard({ event, onShowCoordinates }: EventCardProps) {
    const hasStart = Boolean(event.start_point ?? event.start_coordinates)
    const hasFinish = Boolean(event.finish_point ?? event.finish_coordinates)
    // Если у старта есть и точка, и текстовое место — на кнопке старта показываем место.
    const startLabelOverride = event.start_point ? event.location_text : null
    // Сводка расписания — один проход по датам события.
    const { next, ongoing, schedule } = useMemo(() => summarizeEvent(event), [event])
    const typeLabel = EVENT_TYPE_LABELS[event.type]

    return (
        <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {event.photo_url && (
                <img
                    src={event.photo_url}
                    alt={event.title}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                />
            )}
            <div className="p-4">
                <span className="inline-flex items-center rounded-full bg-[#f25824]/10 px-2.5 py-0.5 text-xs font-semibold text-[#f25824]">
                    {typeLabel}
                </span>
                <h3 className="mt-2 text-base font-semibold text-neutral-900">{event.title}</h3>

                {event.description && (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-neutral-600">{event.description}</p>
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
                            <span>Следующее: {formatOccurrenceLabel(next.start, undefined, event.duration_minutes)}</span>
                        </div>
                    )}
                    {event.location_text && !startLabelOverride && (
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faLocationDot} className="w-4 text-neutral-400" aria-hidden />
                            <span>{event.location_text}</span>
                        </div>
                    )}
                </div>

                {(hasStart || hasFinish) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <EndpointButton
                            icon={faLocationDot}
                            iconClassName="text-[#f25824]"
                            fallbackLabel="Старт на карте"
                            point={event.start_point}
                            coordinates={event.start_coordinates}
                            labelOverride={startLabelOverride}
                            onShowCoordinates={onShowCoordinates}
                        />
                        <EndpointButton
                            icon={faFlagCheckered}
                            iconClassName="text-neutral-500"
                            fallbackLabel="Финиш на карте"
                            point={event.finish_point}
                            coordinates={event.finish_coordinates}
                            onShowCoordinates={onShowCoordinates}
                        />
                    </div>
                )}
            </div>
        </article>
    )
}
