import { describe, expect, it } from 'vitest'
import {
    compareEventsForList,
    DEFAULT_EVENT_HOUR,
    fromDatetimeLocal,
    matchesEventFilter,
    matchesEventQuery,
    nextDefaultEventDate,
    plusWeek,
    summarizeEventDates,
    toDatetimeLocal,
    type EventDateLike,
    type EventSortInput,
} from '@/admin/utils/eventDates'

/** Локальная дата без возни с таймзоной: тесты сравнивают локальные поля, а не UTC-строку. */
function local(year: number, month: number, day: number, hour = 0, minute = 0): Date {
    return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function date(startsAt: Date, cancelled = false): EventDateLike {
    return { starts_at: startsAt.toISOString(), cancelled }
}

describe('nextDefaultEventDate', () => {
    it('до вечернего часа предлагает сегодняшний слот', () => {
        const result = nextDefaultEventDate(local(2026, 8, 10, 9, 30))
        expect(result.getDate()).toBe(10)
        expect(result.getHours()).toBe(DEFAULT_EVENT_HOUR)
        expect(result.getMinutes()).toBe(0)
    })

    it('после вечернего часа переносит на завтра, а не оставляет дату в прошлом', () => {
        const now = local(2026, 8, 10, 22, 15)
        const result = nextDefaultEventDate(now)
        expect(result.getDate()).toBe(11)
        expect(result.getHours()).toBe(DEFAULT_EVENT_HOUR)
        expect(result.getTime()).toBeGreaterThan(now.getTime())
    })

    it('ровно в вечерний час переносит на завтра (слот уже наступил)', () => {
        const result = nextDefaultEventDate(local(2026, 8, 10, DEFAULT_EVENT_HOUR, 0))
        expect(result.getDate()).toBe(11)
    })

    it('на границе месяца переходит на следующий месяц', () => {
        const result = nextDefaultEventDate(local(2026, 8, 31, 23, 0))
        expect(result.getMonth()).toBe(8) // сентябрь (0-based)
        expect(result.getDate()).toBe(1)
    })
})

describe('plusWeek', () => {
    it('добавляет ровно семь дней, сохраняя время', () => {
        const result = plusWeek(local(2026, 8, 10, 19, 0))
        expect(result.getDate()).toBe(17)
        expect(result.getHours()).toBe(19)
    })

    it('корректно перешагивает конец месяца', () => {
        const result = plusWeek(local(2026, 8, 28, 19, 30))
        expect(result.getMonth()).toBe(8)
        expect(result.getDate()).toBe(4)
    })
})

describe('toDatetimeLocal / fromDatetimeLocal', () => {
    it('round-trip сохраняет локальные дату и время до минут', () => {
        const source = local(2026, 8, 10, 19, 5)
        const restored = fromDatetimeLocal(toDatetimeLocal(source))
        expect(restored).not.toBeNull()
        expect(restored?.getTime()).toBe(source.getTime())
    })

    it('дополняет однозначные месяц, день, час и минуту нулём', () => {
        expect(toDatetimeLocal(local(2026, 1, 2, 3, 4))).toBe('2026-01-02T03:04')
    })

    it('на некорректной дате отдаёт пустую строку', () => {
        expect(toDatetimeLocal(new Date('нет такой даты'))).toBe('')
    })

    it('на пустом и мусорном значении отдаёт null', () => {
        expect(fromDatetimeLocal('')).toBeNull()
        expect(fromDatetimeLocal('не дата')).toBeNull()
    })
})

describe('summarizeEventDates', () => {
    const now = local(2026, 8, 10, 12, 0)

    it('без дат отдаёт статус none', () => {
        const summary = summarizeEventDates([], now)
        expect(summary).toMatchObject({ next: null, lastPast: null, totalCount: 0, status: 'none' })
    })

    it('выбирает ближайшую будущую дату, а не первую в массиве', () => {
        const far = date(local(2026, 9, 1, 19, 0))
        const near = date(local(2026, 8, 12, 19, 0))
        const summary = summarizeEventDates([far, near], now)
        expect(summary.next).toBe(near)
        expect(summary.upcomingCount).toBe(2)
        expect(summary.status).toBe('upcoming')
    })

    it('выбирает последнюю прошедшую дату, когда будущих нет', () => {
        const old = date(local(2026, 7, 1, 19, 0))
        const recent = date(local(2026, 8, 9, 19, 0))
        const summary = summarizeEventDates([old, recent], now)
        expect(summary.next).toBeNull()
        expect(summary.lastPast).toBe(recent)
        expect(summary.status).toBe('past')
    })

    it('отменённые даты не становятся ближайшими, но считаются в счётчиках', () => {
        const cancelled = date(local(2026, 8, 12, 19, 0), true)
        const active = date(local(2026, 8, 20, 19, 0))
        const summary = summarizeEventDates([cancelled, active], now)
        expect(summary.next).toBe(active)
        expect(summary.cancelledCount).toBe(1)
        expect(summary.totalCount).toBe(2)
        expect(summary.upcomingCount).toBe(1)
    })

    it('событие только с отменёнными датами требует внимания — статус none', () => {
        const summary = summarizeEventDates([date(local(2026, 8, 12, 19, 0), true)], now)
        expect(summary.status).toBe('none')
        expect(summary.next).toBeNull()
        expect(summary.lastPast).toBeNull()
    })

    it('дата ровно «сейчас» считается будущей — событие идёт прямо сейчас', () => {
        const summary = summarizeEventDates([date(now)], now)
        expect(summary.status).toBe('upcoming')
    })

    it('битую дату пропускает, не роняя сводку', () => {
        const broken: EventDateLike = { starts_at: 'не дата', cancelled: false }
        const summary = summarizeEventDates([broken, date(local(2026, 8, 20, 19, 0))], now)
        expect(summary.status).toBe('upcoming')
        expect(summary.upcomingCount).toBe(1)
        expect(summary.totalCount).toBe(2)
    })
})

describe('matchesEventFilter', () => {
    it('«Все» пропускает любой статус', () => {
        expect(matchesEventFilter('past', 'all')).toBe(true)
        expect(matchesEventFilter('none', 'all')).toBe(true)
    })

    it('остальные фильтры сравнивают статус напрямую', () => {
        expect(matchesEventFilter('upcoming', 'upcoming')).toBe(true)
        expect(matchesEventFilter('upcoming', 'past')).toBe(false)
    })
})

describe('matchesEventQuery', () => {
    it('пустой запрос пропускает всё', () => {
        expect(matchesEventQuery('Покатушка', '')).toBe(true)
        expect(matchesEventQuery('Покатушка', '   ')).toBe(true)
    })

    it('ищет по подстроке без учёта регистра и пробелов по краям', () => {
        expect(matchesEventQuery('Вечерняя покатушка', ' ПОКАТ ')).toBe(true)
        expect(matchesEventQuery('Вечерняя покатушка', 'обучение')).toBe(false)
    })
})

describe('compareEventsForList', () => {
    const base: EventSortInput = {
        status: 'upcoming',
        nextAt: null,
        lastPastAt: null,
        createdAt: '2026-01-01T00:00:00Z',
    }

    it('группы идут в порядке: предстоящие → без даты → прошедшие', () => {
        const upcoming = { ...base, status: 'upcoming' as const }
        const none = { ...base, status: 'none' as const }
        const past = { ...base, status: 'past' as const }
        expect(compareEventsForList(upcoming, none)).toBeLessThan(0)
        expect(compareEventsForList(none, past)).toBeLessThan(0)
        expect(compareEventsForList(past, upcoming)).toBeGreaterThan(0)
    })

    it('внутри предстоящих ближайшая дата — первой', () => {
        const near = { ...base, nextAt: '2026-08-12T19:00:00Z' }
        const far = { ...base, nextAt: '2026-09-01T19:00:00Z' }
        expect(compareEventsForList(near, far)).toBeLessThan(0)
    })

    it('внутри прошедших недавняя дата — первой', () => {
        const recent: EventSortInput = { ...base, status: 'past', lastPastAt: '2026-08-09T19:00:00Z' }
        const old: EventSortInput = { ...base, status: 'past', lastPastAt: '2026-07-01T19:00:00Z' }
        expect(compareEventsForList(recent, old)).toBeLessThan(0)
    })

    it('события без дат сортируются по дате создания, новые сверху', () => {
        const fresh: EventSortInput = { ...base, status: 'none', createdAt: '2026-08-01T00:00:00Z' }
        const stale: EventSortInput = { ...base, status: 'none', createdAt: '2026-01-01T00:00:00Z' }
        expect(compareEventsForList(fresh, stale)).toBeLessThan(0)
    })
})
