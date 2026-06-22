import type { EventDateRow, EventRow } from '@/types'

/** Дата проведения события для фикстур. */
export function eventDate(overrides: Partial<EventDateRow> = {}): EventDateRow {
    return { id: 'd1', starts_at: '2026-06-25T19:00:00', note: null, cancelled: false, ...overrides }
}

/** ISO-дата со смещением от «сейчас» в днях, время по умолчанию 19:00 локально. */
export function dateAt(daysFromNow: number, hour = 19): string {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
}

/** Полное событие `EventRow` со значениями по умолчанию; перекрывается через `overrides`. */
export function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
    return {
        id: 'e1',
        created_at: '2026-06-01T00:00:00.000Z',
        type: 'group_ride',
        title: 'Тестовое событие',
        description: null,
        photo_url: null,
        duration_minutes: null,
        location_text: null,
        start_coordinates: null,
        finish_coordinates: null,
        start_point: null,
        finish_point: null,
        dates: [],
        ...overrides,
    }
}
