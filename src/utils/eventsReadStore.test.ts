import { afterEach, describe, expect, it } from 'vitest'
import { countUnreadEvents, loadLastReadAt, saveLastReadAt } from '@/utils/eventsReadStore'
import { eventDate, makeEvent as makeBaseEvent } from '@/test/eventFactories'
import type { EventRow } from '@/types'

// Базовое событие для этого набора: создано до `now` (2026-07-01), дата проведения — в будущем.
function makeEvent(overrides: Partial<EventRow>): EventRow {
    return makeBaseEvent({
        created_at: '2026-06-10T00:00:00.000Z',
        dates: [eventDate({ starts_at: '2026-07-10T19:00:00' })],
        ...overrides,
    })
}

afterEach(() => {
    localStorage.clear()
})

describe('loadLastReadAt / saveLastReadAt', () => {
    it('сохраняет и читает дату', () => {
        saveLastReadAt('2026-06-15T10:00:00.000Z')
        expect(loadLastReadAt()).toBe('2026-06-15T10:00:00.000Z')
    })

    it('по умолчанию пишет текущее время', () => {
        saveLastReadAt()
        const stored = loadLastReadAt()
        expect(stored).not.toBeNull()
        expect(Number.isNaN(new Date(stored ?? '').getTime())).toBe(false)
    })

    it('возвращает null, если ничего не сохранено', () => {
        expect(loadLastReadAt()).toBeNull()
    })
})

describe('countUnreadEvents', () => {
    const now = new Date('2026-07-01T00:00:00')

    it('если ленту не открывали — все актуальные события считаются новыми', () => {
        const events = [makeEvent({ id: '1' }), makeEvent({ id: '2' })]
        expect(countUnreadEvents(events, null, now)).toBe(2)
    })

    it('не считает завершившиеся события', () => {
        const events = [
            makeEvent({
                id: '1',
                dates: [{ id: 'd1', starts_at: '2026-07-10T19:00:00', note: null, cancelled: false }],
            }),
            makeEvent({
                id: '2',
                dates: [{ id: 'd2', starts_at: '2026-06-01T19:00:00', note: null, cancelled: false }],
            }),
        ]
        expect(countUnreadEvents(events, null, now)).toBe(1)
    })

    it('считает только события, созданные позже последнего просмотра', () => {
        const events = [
            makeEvent({ id: '1', created_at: '2026-06-20T00:00:00.000Z' }),
            makeEvent({ id: '2', created_at: '2026-06-05T00:00:00.000Z' }),
        ]
        expect(countUnreadEvents(events, '2026-06-10T00:00:00.000Z', now)).toBe(1)
    })

    it('возвращает 0, если всё прочитано', () => {
        const events = [makeEvent({ id: '1', created_at: '2026-06-05T00:00:00.000Z' })]
        expect(countUnreadEvents(events, '2026-06-30T00:00:00.000Z', now)).toBe(0)
    })

    it('повреждённая дата просмотра трактуется как «не открывали» (а не «всё прочитано»)', () => {
        const events = [makeEvent({ id: '1' }), makeEvent({ id: '2' })]
        expect(countUnreadEvents(events, 'не-дата', now)).toBe(2)
    })
})
