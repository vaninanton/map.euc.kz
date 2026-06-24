import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
    faArrowLeft,
    faCalendarDay,
    faClock,
    faFlagCheckered,
    faHourglassHalf,
    faLocationDot,
} from '@fortawesome/free-solid-svg-icons'
import type { EventRow, EventLinkedPoint } from '@/types'
import { EVENT_TYPE_LABELS } from '@/constants'
import { buildMapDeepLinkPath } from '@/utils/hashNav'
import { applyTypography } from '@/utils/typograf'
import { EventShareBlock } from '@/components/EventShareBlock'
import { formatOccurrenceLabel, getUpcomingOccurrences, summarizeEvent } from '@/utils/eventSchedule'

interface EventDetailScreenProps {
    /** Событие для показа; null — пока грузится или не найдено. */
    event: EventRow | null
    loading: boolean
    error: string | null
    onClose: () => void
    onShowOnMap?: (coordinates: [number, number]) => void
}

interface EndpointRowProps {
    icon: IconDefinition
    iconClassName: string
    label: string
    fallbackLabel: string
    point: EventLinkedPoint | null
    coordinates: [number, number] | null
    /** Переопределяет подпись точки (например, текстовым местом события). */
    labelOverride?: string | null
    onShowCoordinates?: (coordinates: [number, number]) => void
}

/** Строка старта/финиша: ссылка на карточку точки либо центрирование по координатам. */
function EndpointRow({
    icon,
    iconClassName,
    label,
    fallbackLabel,
    point,
    coordinates,
    labelOverride,
    onShowCoordinates,
}: EndpointRowProps) {
    const className =
        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50'

    let control: React.ReactNode = null
    if (point) {
        control = (
            <Link to={`/${buildMapDeepLinkPath('point', point.id)}`} className={className}>
                <FontAwesomeIcon icon={icon} className={iconClassName} aria-hidden />
                {labelOverride ?? point.title}
            </Link>
        )
    } else if (coordinates) {
        control = (
            <button type="button" onClick={() => onShowCoordinates?.(coordinates)} className={className}>
                <FontAwesomeIcon icon={icon} className={iconClassName} aria-hidden />
                {fallbackLabel}
            </button>
        )
    }

    if (!control) return null

    return (
        <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs font-medium text-neutral-400">{label}</span>
            {control}
        </div>
    )
}

/** Полноэкранная страница одного события: фото, тип, расписание, даты, место, шаринг. */
export function EventDetailScreen({ event, loading, error, onClose, onShowOnMap }: EventDetailScreenProps) {
    const startLabelOverride = event?.start_point ? event.location_text : null
    const { ongoing } = useMemo(() => (event ? summarizeEvent(event) : { ongoing: null }), [event])
    const upcoming = useMemo(() => (event ? getUpcomingOccurrences(event, new Date(), 10) : []), [event])

    return (
        <div
            className="fixed inset-0 z-30 flex flex-col bg-neutral-50
                pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]"
            role="dialog"
            aria-label="Событие"
        >
            {/* Шапка */}
            <header
                className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 py-3"
                style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="-m-2 cursor-pointer rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Назад"
                >
                    <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-neutral-900">
                    {event ? event.title : 'Событие'}
                </h1>
            </header>

            {/* Контент */}
            <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                {error && <div className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {loading && !error && (
                    <div className="py-12 text-center text-sm text-neutral-400">Загрузка события…</div>
                )}
                {!loading && !error && !event && (
                    <div className="py-12 text-center text-sm text-neutral-400">Событие не найдено</div>
                )}
                {event && !error && (
                    <article className="mx-auto max-w-xl">
                        {event.photo_url && (
                            <img
                                src={event.photo_url}
                                alt={event.title}
                                className="h-56 w-full object-cover"
                                loading="lazy"
                            />
                        )}
                        <div className="p-4">
                            <span className="inline-flex items-center rounded-full bg-[#f25824]/10 px-2.5 py-0.5 text-xs font-semibold text-[#f25824]">
                                {EVENT_TYPE_LABELS[event.type]}
                            </span>
                            <h2 className="mt-2 text-xl font-semibold text-neutral-900">{event.title}</h2>

                            {ongoing && (
                                <div className="mt-2 flex items-center gap-2 font-semibold text-green-700">
                                    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
                                        <span className="absolute inset-0 rounded-full bg-green-500 animate-live-ping" />
                                        <span className="relative inline-block h-2 w-2 rounded-full bg-green-500" />
                                    </span>
                                    <span>Сейчас</span>
                                </div>
                            )}

                            {event.description && (
                                <p
                                    className="mt-3 whitespace-pre-line text-sm text-neutral-600"
                                    dangerouslySetInnerHTML={{ __html: applyTypography(event.description) }}
                                />
                            )}

                            {/* Расписание: все ближайшие даты */}
                            <div className="mt-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                                    Расписание
                                </h3>
                                {upcoming.length > 0 ? (
                                    <ul className="mt-2 space-y-1.5">
                                        {upcoming.map((occ) => (
                                            <li
                                                key={occ.start.toISOString()}
                                                className="flex items-center gap-2 text-sm text-neutral-800"
                                            >
                                                <FontAwesomeIcon
                                                    icon={faCalendarDay}
                                                    className="w-4 text-[#f25824]"
                                                    aria-hidden
                                                />
                                                <span className="font-medium">
                                                    {formatOccurrenceLabel(
                                                        occ.start,
                                                        undefined,
                                                        event.duration_minutes,
                                                    )}
                                                </span>
                                                {occ.note && <span className="text-neutral-500">· {occ.note}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-neutral-400">
                                        <FontAwesomeIcon icon={faClock} className="w-4" aria-hidden />
                                        <span>Предстоящих дат нет</span>
                                    </div>
                                )}
                                {event.duration_minutes && event.duration_minutes > 0 && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
                                        <FontAwesomeIcon icon={faHourglassHalf} className="w-4" aria-hidden />
                                        <span>Длительность: {event.duration_minutes} мин</span>
                                    </div>
                                )}
                            </div>

                            {/* Место */}
                            {event.location_text && !startLabelOverride && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-neutral-700">
                                    <FontAwesomeIcon
                                        icon={faLocationDot}
                                        className="w-4 text-neutral-400"
                                        aria-hidden
                                    />
                                    <span>{event.location_text}</span>
                                </div>
                            )}

                            {/* Старт / финиш */}
                            <div className="mt-4 space-y-2">
                                <EndpointRow
                                    icon={faLocationDot}
                                    iconClassName="text-[#f25824]"
                                    label="Старт"
                                    fallbackLabel="Показать на карте"
                                    point={event.start_point}
                                    coordinates={event.start_coordinates}
                                    labelOverride={startLabelOverride}
                                    onShowCoordinates={onShowOnMap}
                                />
                                <EndpointRow
                                    icon={faFlagCheckered}
                                    iconClassName="text-neutral-500"
                                    label="Финиш"
                                    fallbackLabel="Показать на карте"
                                    point={event.finish_point}
                                    coordinates={event.finish_coordinates}
                                    onShowCoordinates={onShowOnMap}
                                />
                            </div>

                            {/* Поделиться — как у точки/маршрута, под карточкой */}
                            <EventShareBlock event={event} />
                        </div>
                    </article>
                )}
            </div>
        </div>
    )
}
