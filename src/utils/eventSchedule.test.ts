import { describe, expect, it } from 'vitest'
import {
    formatDate,
    formatOccurrenceLabel,
    formatTime,
    getNextOccurrence,
    getUpcomingOccurrences,
    summarizeEvent,
    toDateKey,
} from '@/utils/eventSchedule'
import type { EventDateRow, EventRow } from '@/types'

function makeEvent(dates: EventDateRow[], overrides: Partial<EventRow> = {}): EventRow {
    return {
        id: '1',
        created_at: '2026-06-01T00:00:00.000Z',
        type: 'training',
        title: 'Тестовое событие',
        description: null,
        photo_url: null,
        duration_minutes: null,
        location_text: null,
        start_coordinates: null,
        finish_coordinates: null,
        start_point: null,
        finish_point: null,
        dates,
        ...overrides,
    }
}

function date(id: string, iso: string, note: string | null = null, cancelled = false): EventDateRow {
    return { id, starts_at: iso, note, cancelled }
}

describe('toDateKey', () => {
    it('форматирует дату как YYYY-MM-DD по локальному времени', () => {
        expect(toDateKey(new Date(2026, 6, 5, 23, 30))).toBe('2026-07-05')
    })
})

describe('getUpcomingOccurrences', () => {
    it('возвращает будущие даты, отсортированные по времени', () => {
        const event = makeEvent([
            date('a', '2026-07-20T21:00:00'),
            date('b', '2026-07-10T21:30:00'),
            date('c', '2026-07-15T19:00:00'),
        ])
        const occ = getUpcomingOccurrences(event, new Date('2026-07-01T00:00:00'))
        expect(occ.map((o) => o.date)).toEqual(['2026-07-10', '2026-07-15', '2026-07-20'])
    })

    it('отсекает прошедшие даты', () => {
        const event = makeEvent([
            date('a', '2026-06-01T21:00:00'),
            date('b', '2026-07-10T21:00:00'),
        ])
        const occ = getUpcomingOccurrences(event, new Date('2026-07-01T00:00:00'))
        expect(occ.map((o) => o.date)).toEqual(['2026-07-10'])
    })

    it('у каждой даты своё время', () => {
        const event = makeEvent([
            date('a', '2026-07-10T21:30:00'),
            date('b', '2026-07-12T21:00:00'),
        ])
        const occ = getUpcomingOccurrences(event, new Date('2026-07-01T00:00:00'))
        expect(occ[0].start.getHours()).toBe(21)
        expect(occ[0].start.getMinutes()).toBe(30)
        expect(occ[1].start.getMinutes()).toBe(0)
    })

    it('соблюдает limit', () => {
        const event = makeEvent([
            date('a', '2026-07-10T21:00:00'),
            date('b', '2026-07-11T21:00:00'),
            date('c', '2026-07-12T21:00:00'),
        ])
        expect(getUpcomingOccurrences(event, new Date('2026-07-01T00:00:00'), 2)).toHaveLength(2)
    })

    it('пустой список дат — нет вхождений', () => {
        expect(getUpcomingOccurrences(makeEvent([]), new Date('2026-07-01T00:00:00'))).toHaveLength(0)
    })

    it('исключает отменённые даты', () => {
        const event = makeEvent([
            date('a', '2026-07-10T21:00:00', null, true),
            date('b', '2026-07-12T21:00:00'),
        ])
        const occ = getUpcomingOccurrences(event, new Date('2026-07-01T00:00:00'))
        expect(occ.map((o) => o.date)).toEqual(['2026-07-12'])
    })
})

describe('getNextOccurrence', () => {
    it('возвращает ближайшую будущую дату', () => {
        const event = makeEvent([date('a', '2026-07-20T21:00:00'), date('b', '2026-07-10T21:00:00')])
        expect(getNextOccurrence(event, new Date('2026-07-01T00:00:00'))?.date).toBe('2026-07-10')
    })

    it('null, если все даты в прошлом', () => {
        const event = makeEvent([date('a', '2026-06-01T21:00:00')])
        expect(getNextOccurrence(event, new Date('2026-07-01T00:00:00'))).toBeNull()
    })
})

describe('summarizeEvent', () => {
    const from = new Date('2026-07-01T00:00:00')

    it('одна дата — расписание = ближайшая дата, next задан', () => {
        const summary = summarizeEvent(makeEvent([date('a', '2026-07-10T21:30:00')]), from)
        expect(summary.schedule).toBe('10 июля, 21:30')
        expect(summary.next?.date).toBe('2026-07-10')
        expect(summary.isPast).toBe(false)
    })

    it('несколько дат — расписание = только ближайшая дата', () => {
        const summary = summarizeEvent(
            makeEvent([date('a', '2026-07-12T21:00:00'), date('b', '2026-07-10T21:00:00')]),
            from,
        )
        expect(summary.schedule).toBe('10 июля, 21:00')
        expect(summary.next?.date).toBe('2026-07-10')
    })

    it('длительность — расписание показывает интервал', () => {
        const summary = summarizeEvent(
            makeEvent([date('a', '2026-07-10T21:00:00')], { duration_minutes: 90 }),
            from,
        )
        expect(summary.schedule).toBe('10 июля, 21:00–22:30')
    })

    it('нет дат — сообщение, next null, не «прошло»', () => {
        const summary = summarizeEvent(makeEvent([]), from)
        expect(summary.schedule).toBe('Даты не заданы')
        expect(summary.next).toBeNull()
        expect(summary.isPast).toBe(false)
    })

    it('все даты в прошлом — isPast и next null', () => {
        const summary = summarizeEvent(makeEvent([date('a', '2026-06-01T21:00:00')]), from)
        expect(summary.next).toBeNull()
        expect(summary.ongoing).toBeNull()
        expect(summary.isPast).toBe(true)
    })

    it('идущее сейчас (в пределах длительности) — ongoing задан, не «прошло»', () => {
        const event = makeEvent([date('a', '2026-07-10T19:00:00')], { duration_minutes: 90 })
        // now = 19:30 того же дня — в пределах 90 минут от старта
        const summary = summarizeEvent(event, new Date('2026-07-10T19:30:00'))
        expect(summary.ongoing?.date).toBe('2026-07-10')
        expect(summary.next).toBeNull()
        expect(summary.isPast).toBe(false)
    })

    it('идёт сейчас + есть будущая дата — ongoing и next вместе', () => {
        const event = makeEvent(
            [date('a', '2026-07-10T19:00:00'), date('b', '2026-07-17T19:00:00')],
            { duration_minutes: 90 },
        )
        const summary = summarizeEvent(event, new Date('2026-07-10T19:30:00'))
        expect(summary.ongoing?.date).toBe('2026-07-10')
        expect(summary.next?.date).toBe('2026-07-17')
    })

    it('после длительности событие уже не идёт', () => {
        const event = makeEvent([date('a', '2026-07-10T19:00:00')], { duration_minutes: 60 })
        const summary = summarizeEvent(event, new Date('2026-07-10T20:30:00'))
        expect(summary.ongoing).toBeNull()
        expect(summary.isPast).toBe(true)
    })
})

describe('formatOccurrenceLabel', () => {
    it('сегодня', () => {
        const now = new Date('2026-07-10T08:00:00')
        expect(formatOccurrenceLabel(new Date('2026-07-10T19:00:00'), now)).toBe('Сегодня в 19:00')
    })

    it('завтра', () => {
        const now = new Date('2026-07-10T08:00:00')
        expect(formatOccurrenceLabel(new Date('2026-07-11T21:30:00'), now)).toBe('Завтра в 21:30')
    })

    it('дальше — дата и время', () => {
        const now = new Date('2026-07-10T08:00:00')
        expect(formatOccurrenceLabel(new Date('2026-07-14T19:00:00'), now)).toBe('14 июля, 19:00')
    })

    it('с длительностью — интервал', () => {
        const now = new Date('2026-07-10T08:00:00')
        expect(formatOccurrenceLabel(new Date('2026-07-10T19:00:00'), now, 90)).toBe('Сегодня в 19:00–20:30')
    })
})

describe('formatDate / formatTime', () => {
    it('formatTime добавляет ведущие нули', () => {
        expect(formatTime(new Date(2026, 6, 10, 9, 5))).toBe('09:05')
    })

    it('formatDate опускает год для текущего года', () => {
        expect(formatDate(new Date(2026, 6, 10), new Date(2026, 0, 1))).toBe('10 июля')
    })

    it('formatDate показывает год для другого года', () => {
        expect(formatDate(new Date(2027, 6, 10), new Date(2026, 0, 1))).toBe('10 июля 2027')
    })
})
