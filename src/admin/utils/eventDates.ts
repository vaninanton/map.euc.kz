/**
 * Чистые функции для работы с датами событий в админке: дефолты для новой даты,
 * сводка по списку дат (ближайшая/прошедшая) и правила фильтрации-сортировки списка событий.
 * Без React и Supabase — всё покрыто тестами.
 */

/** Минимум, который нужен функциям от строки даты события. */
export interface EventDateLike {
    starts_at: string
    cancelled: boolean
}

/** Час по умолчанию для новой даты события — вечерний слот, когда обычно катают. */
export const DEFAULT_EVENT_HOUR = 19

/** Сколько дней в неделе — шаг кнопки «+1 неделя». */
const DAYS_IN_WEEK = 7

/**
 * Ближайший разумный слот для новой даты: сегодня в DEFAULT_EVENT_HOUR, а если этот час уже
 * прошёл — завтра. Прежний дефолт всегда ставил сегодняшние 21:00, то есть после 21:00
 * подсовывал дату в прошлом.
 */
export function nextDefaultEventDate(now: Date): Date {
    const candidate = new Date(now)
    candidate.setHours(DEFAULT_EVENT_HOUR, 0, 0, 0)
    if (candidate.getTime() <= now.getTime()) {
        candidate.setDate(candidate.getDate() + 1)
    }
    return candidate
}

/** Та же дата и время неделей позже — для быстрого добавления повторов. */
export function plusWeek(date: Date): Date {
    const next = new Date(date)
    next.setDate(next.getDate() + DAYS_IN_WEEK)
    return next
}

/** Значение для `<input type="datetime-local">` из Date (локальное время, до минут). */
export function toDatetimeLocal(date: Date): string {
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = String(date.getFullYear())
    return `${y}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Разбор значения `<input type="datetime-local">`; null, если значение некорректно. */
export function fromDatetimeLocal(value: string): Date | null {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Статус события по его датам: есть будущая, только прошедшие, либо активных дат нет. */
export type EventDateStatus = 'upcoming' | 'past' | 'none'

export interface EventDatesSummary<T extends EventDateLike> {
    /** Ближайшая будущая неотменённая дата. */
    next: T | null
    /** Последняя прошедшая неотменённая дата. */
    lastPast: T | null
    /** Сколько будущих неотменённых дат. */
    upcomingCount: number
    /** Сколько дат всего, включая отменённые и прошедшие. */
    totalCount: number
    /** Сколько дат отменено. */
    cancelledCount: number
    status: EventDateStatus
}

/**
 * Сводка по датам события. Отменённые даты не участвуют в `next`/`lastPast` — они не проводятся,
 * поэтому событие только с отменёнными датами попадает в статус `none` и требует внимания.
 */
export function summarizeEventDates<T extends EventDateLike>(dates: readonly T[], now: Date): EventDatesSummary<T> {
    const nowTs = now.getTime()
    let next: T | null = null
    let lastPast: T | null = null
    let upcomingCount = 0
    let cancelledCount = 0

    for (const date of dates) {
        if (date.cancelled) {
            cancelledCount += 1
            continue
        }
        const ts = new Date(date.starts_at).getTime()
        if (Number.isNaN(ts)) continue

        if (ts >= nowTs) {
            upcomingCount += 1
            if (next === null || ts < new Date(next.starts_at).getTime()) next = date
        } else if (lastPast === null || ts > new Date(lastPast.starts_at).getTime()) {
            lastPast = date
        }
    }

    return {
        next,
        lastPast,
        upcomingCount,
        totalCount: dates.length,
        cancelledCount,
        status: next !== null ? 'upcoming' : lastPast !== null ? 'past' : 'none',
    }
}

/** Фильтр списка событий в админке. */
export type EventListFilter = 'upcoming' | 'past' | 'none' | 'all'

export const EVENT_LIST_FILTERS: readonly (readonly [EventListFilter, string])[] = [
    ['upcoming', 'Предстоящие'],
    ['past', 'Прошедшие'],
    ['none', 'Без даты'],
    ['all', 'Все'],
]

/** Подходит ли событие под фильтр списка. */
export function matchesEventFilter(status: EventDateStatus, filter: EventListFilter): boolean {
    return filter === 'all' || status === filter
}

/** Подходит ли название под поисковый запрос (регистронезависимо, по подстроке). */
export function matchesEventQuery(title: string, query: string): boolean {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return true
    return title.toLowerCase().includes(normalized)
}

/**
 * Порядок сортировки списка: предстоящие — ближайшие сверху, прошедшие — свежие сверху,
 * события без активных дат — новые сверху. Во вкладке «Все» группы идут в том же порядке,
 * что и вкладки: сначала предстоящие, затем без даты, затем прошедшие.
 */
const STATUS_ORDER: Record<EventDateStatus, number> = { upcoming: 0, none: 1, past: 2 }

export interface EventSortInput {
    status: EventDateStatus
    /** ISO ближайшей будущей даты, если есть. */
    nextAt: string | null
    /** ISO последней прошедшей даты, если есть. */
    lastPastAt: string | null
    /** ISO создания — запасной ключ для событий без дат. */
    createdAt: string
}

export function compareEventsForList(a: EventSortInput, b: EventSortInput): number {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]

    if (a.status === 'upcoming') {
        // Ближайшая дата — сверху.
        return new Date(a.nextAt ?? 0).getTime() - new Date(b.nextAt ?? 0).getTime()
    }
    if (a.status === 'past') {
        // Недавно прошедшая — сверху.
        return new Date(b.lastPastAt ?? 0).getTime() - new Date(a.lastPastAt ?? 0).getTime()
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}
