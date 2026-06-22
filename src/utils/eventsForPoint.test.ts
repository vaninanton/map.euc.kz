import { describe, expect, it } from 'vitest'
import { eventsForPoint } from '@/utils/eventsForPoint'
import { makeEvent } from '@/test/eventFactories'
import type { EventLinkedPoint } from '@/types'

function point(id: string): EventLinkedPoint {
    return { id, title: `Точка ${id}`, coordinates: [76.9, 43.2] }
}

describe('eventsForPoint', () => {
    it('находит события, где точка — старт', () => {
        const events = [makeEvent({ id: '1', start_point: point('5') }), makeEvent({ id: '2' })]
        expect(eventsForPoint(events, '5').map((e) => e.id)).toEqual(['1'])
    })

    it('находит события, где точка — финиш', () => {
        const events = [makeEvent({ id: '1', finish_point: point('7') })]
        expect(eventsForPoint(events, '7').map((e) => e.id)).toEqual(['1'])
    })

    it('находит событие, если точка и старт, и финиш — без дублей', () => {
        const events = [makeEvent({ id: '1', start_point: point('5'), finish_point: point('5') })]
        expect(eventsForPoint(events, '5')).toHaveLength(1)
    })

    it('возвращает пусто, если точка ни с чем не связана', () => {
        const events = [makeEvent({ id: '1', start_point: point('5') })]
        expect(eventsForPoint(events, '99')).toEqual([])
    })
})
