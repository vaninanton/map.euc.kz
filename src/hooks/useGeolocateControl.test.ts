import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Map as MapboxMap } from 'mapbox-gl'
import { useGeolocateControl } from './useGeolocateControl'

const { trackGoalMock } = vi.hoisted(() => ({ trackGoalMock: vi.fn() }))
vi.mock('@/lib/analytics', () => ({ trackGoal: trackGoalMock }))

/** Перехватывает обработчики, переданные в geolocate.on(...), чтобы дёргать их в тесте. */
let handlers: Map<string, (arg?: unknown) => void> = new Map()

vi.mock('mapbox-gl', () => {
    class GeolocateControl {
        on(event: string, cb: (arg?: unknown) => void) {
            handlers.set(event, cb)
        }
        off() {
            /* noop */
        }
    }
    return { default: { GeolocateControl } }
})

/** Вызывает перехваченный обработчик события; падает, если он не зарегистрирован. */
function fire(event: string, arg?: unknown): void {
    const handler = handlers.get(event)
    if (!handler) throw new Error(`Обработчик "${event}" не зарегистрирован`)
    handler(arg)
}

function makeMap(): MapboxMap {
    return {
        addControl: vi.fn(),
        removeControl: vi.fn(),
    } as unknown as MapboxMap
}

beforeEach(() => {
    trackGoalMock.mockClear()
    handlers = new Map()
})

describe('useGeolocateControl — цели геолокации', () => {
    it('шлёт geolocation_success при первом успехе', () => {
        renderHook(() => useGeolocateControl(makeMap(), true))
        fire('geolocate')
        expect(trackGoalMock).toHaveBeenCalledWith('geolocation_success')
    })

    it('не дублирует geolocation_success при повторных событиях geolocate', () => {
        renderHook(() => useGeolocateControl(makeMap(), true))
        fire('geolocate')
        fire('geolocate')
        fire('geolocate')
        expect(trackGoalMock).toHaveBeenCalledTimes(1)
    })

    it('шлёт geolocation_denied при отказе в доступе', () => {
        renderHook(() => useGeolocateControl(makeMap(), true))
        fire('error', { code: 1, PERMISSION_DENIED: 1 })
        expect(trackGoalMock).toHaveBeenCalledWith('geolocation_denied')
    })

    it('не шлёт geolocation_denied при прочих ошибках', () => {
        renderHook(() => useGeolocateControl(makeMap(), true))
        fire('error', { code: 3, PERMISSION_DENIED: 1, TIMEOUT: 3 })
        expect(trackGoalMock).not.toHaveBeenCalled()
    })
})
