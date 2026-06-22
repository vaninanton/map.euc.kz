import type { EventRow } from '@/types'

/** Одно конкретное вхождение события в расписании. */
export interface EventOccurrence {
    /** Дата вхождения в формате YYYY-MM-DD (по локальному времени). */
    date: string
    /** Дата-время начала вхождения. */
    start: Date
    /** Заметка к дате, если есть. */
    note: string | null
}

const MONTH_NAMES = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

/** Дата в формате YYYY-MM-DD по локальному времени. */
export function toDateKey(date: Date): string {
    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Единый источник истины: актуальные вхождения события (не отменённые, с валидной
 * датой), отсортированные по времени. Все остальные функции расписания строятся
 * поверх этого, чтобы правила «что считается вхождением» не расходились.
 */
function validOccurrences(event: EventRow): EventOccurrence[] {
    return event.dates
        .filter((d) => !d.cancelled)
        .map((d) => ({ date: '', start: new Date(d.starts_at), note: d.note }))
        .filter((d) => !Number.isNaN(d.start.getTime()))
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map((d) => ({ date: toDateKey(d.start), start: d.start, note: d.note }))
}

/**
 * Ближайшие будущие вхождения события (по списку дат), отсортированные по времени.
 */
export function getUpcomingOccurrences(event: EventRow, from: Date = new Date(), limit = 5): EventOccurrence[] {
    const fromTime = from.getTime()
    return validOccurrences(event)
        .filter((o) => o.start.getTime() >= fromTime)
        .slice(0, limit)
}

/** Ближайшее будущее вхождение (или null, если все даты в прошлом / их нет). */
export function getNextOccurrence(event: EventRow, from: Date = new Date()): EventOccurrence | null {
    return getUpcomingOccurrences(event, from, 1)[0] ?? null
}

/** «14 июля» (без года, если в текущем году) либо «14 июля 2027». */
export function formatDate(date: Date, now: Date = new Date()): string {
    const base = `${String(date.getDate())} ${MONTH_NAMES[date.getMonth()]}`
    return date.getFullYear() === now.getFullYear() ? base : `${base} ${String(date.getFullYear())}`
}

/** «19:00». */
export function formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
}

/** Разница в календарных днях между датами (по локальной полуночи): 0 — сегодня, 1 — завтра. */
function calendarDayDiff(date: Date, now: Date): number {
    const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return Math.round((a - b) / (24 * 60 * 60 * 1000))
}

/**
 * Человекочитаемое время вхождения: «Сегодня в 19:00», «Завтра в 19:00»,
 * иначе «14 июля, 19:00». Если задана длительность — добавляет время окончания
 * («…в 19:00–20:30»).
 */
export function formatOccurrenceLabel(
    date: Date,
    now: Date = new Date(),
    durationMinutes: number | null = null,
): string {
    const time =
        durationMinutes && durationMinutes > 0
            ? `${formatTime(date)}–${formatTime(new Date(date.getTime() + durationMinutes * 60 * 1000))}`
            : formatTime(date)
    const diff = calendarDayDiff(date, now)
    if (diff === 0) return `Сегодня в ${time}`
    if (diff === 1) return `Завтра в ${time}`
    return `${formatDate(date, now)}, ${time}`
}

/** По умолчанию событие считается «идущим» час после старта, если длительность не задана. */
const DEFAULT_ONGOING_MINUTES = 60

/** Сводка расписания для карточки: даты события парсятся один раз. */
export interface EventSummary {
    /** Ближайшее будущее вхождение. */
    next: EventOccurrence | null
    /** Идущее прямо сейчас вхождение (now в пределах start..start+duration). */
    ongoing: EventOccurrence | null
    /** Человекочитаемое описание расписания. */
    schedule: string
    /** Все даты в прошлом (и хотя бы одна была) — событие прошло. */
    isPast: boolean
}

/** Один проход по `event.dates`: идущее/ближайшее вхождение, текст расписания, признак «прошло». */
export function summarizeEvent(event: EventRow, from: Date = new Date()): EventSummary {
    const valid = validOccurrences(event)
    const fromTime = from.getTime()
    const durationMs = (event.duration_minutes ?? DEFAULT_ONGOING_MINUTES) * 60 * 1000

    const ongoing =
        valid.find((o) => {
            const t = o.start.getTime()
            return t <= fromTime && fromTime < t + durationMs
        }) ?? null
    const next = valid.find((o) => o.start.getTime() >= fromTime) ?? null

    // Расписание = ближайшая актуальная дата (идущая сейчас либо следующая).
    let schedule: string
    if (ongoing) {
        schedule = 'Сейчас'
    } else if (next) {
        schedule = formatOccurrenceLabel(next.start, from, event.duration_minutes)
    } else if (valid.length > 0) {
        schedule = 'Событие прошло'
    } else {
        schedule = 'Даты не заданы'
    }

    return { next, ongoing, schedule, isPast: next === null && ongoing === null && valid.length > 0 }
}
