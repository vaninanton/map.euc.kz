import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMapFeatureSelection } from './useMapFeatureSelection'
import type { Feature } from '@/types/geojson'

function makePoint(id: string): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        properties: { id, type: 'point', name: 'Тест' },
    }
}

function makeRoute(id: string): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[76.9, 43.2], [76.95, 43.25]] },
        properties: { id, type: 'route', name: 'Маршрут' },
    }
}

function makeTelegramUser(id: string): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        properties: { id, type: 'telegramUser', name: 'Rider', updatedAt: new Date().toISOString(), telegramUserId: 1 },
    }
}

function makeHook() {
    const flyTo = vi.fn()
    const flyToBounds = vi.fn()
    const getFeatureById = vi.fn().mockReturnValue(null)
    const hook = renderHook(() =>
        useMapFeatureSelection({ getFeatureById, flyTo, flyToBounds }),
    )
    return { ...hook, flyTo, flyToBounds, getFeatureById }
}

describe('useMapFeatureSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('начальное состояние: нет выбранной фичи', () => {
        const { result } = makeHook()
        expect(result.current.selectedFeature).toBeNull()
        expect(result.current.selectedFeatureState).toBeNull()
        expect(result.current.displaySelectedFeature).toBeNull()
    })

    it('openFeature устанавливает selectedFeature', () => {
        const { result } = makeHook()
        const point = makePoint('p1')
        act(() => { result.current.openFeature(point, 'points') })
        expect(result.current.selectedFeature).toBe(point)
    })

    it('openFeature для точки вызывает flyTo', () => {
        const { result, flyTo, flyToBounds } = makeHook()
        act(() => { result.current.openFeature(makePoint('p1'), 'points') })
        expect(flyTo).toHaveBeenCalledOnce()
        expect(flyToBounds).not.toHaveBeenCalled()
    })

    it('openFeature для маршрута вызывает flyToBounds', () => {
        const { result, flyTo, flyToBounds } = makeHook()
        act(() => { result.current.openFeature(makeRoute('r1'), 'routes') })
        expect(flyToBounds).toHaveBeenCalledOnce()
        expect(flyTo).not.toHaveBeenCalled()
    })

    it('openFeature использует переданный lngLat вместо центра фичи', () => {
        const { result, flyTo } = makeHook()
        const lngLat: [number, number] = [77.0, 43.5]
        act(() => { result.current.openFeature(makePoint('p1'), 'points', lngLat) })
        expect(flyTo).toHaveBeenCalledWith(lngLat, expect.any(Number), expect.any(Object))
    })

    it('clearSelection обнуляет фичу', () => {
        const { result } = makeHook()
        act(() => { result.current.openFeature(makePoint('p1'), 'points') })
        act(() => { result.current.clearSelection() })
        expect(result.current.selectedFeature).toBeNull()
        expect(result.current.selectedFeatureState).toBeNull()
    })

    it('handleFeatureSelect эквивалентен openFeature', () => {
        const { result, flyTo } = makeHook()
        const pt = makePoint('p2')
        act(() => { result.current.handleFeatureSelect(pt, 'points', [76.9, 43.2]) })
        expect(result.current.selectedFeature).toBe(pt)
        expect(flyTo).toHaveBeenCalledOnce()
    })

    it('displaySelectedFeature для telegramUser подтягивает актуальные данные из индекса', () => {
        const fresh = makeTelegramUser('tg1')
        const { result, getFeatureById } = makeHook()
        getFeatureById.mockReturnValue(fresh)
        const stale = { ...makeTelegramUser('tg1'), properties: { ...makeTelegramUser('tg1').properties, name: 'Старое имя' } }
        act(() => { result.current.openFeature(stale, 'telegramUsers') })
        expect(result.current.displaySelectedFeature).toBe(fresh)
    })

    it('displaySelectedFeature для обычной фичи возвращает selectedFeature напрямую', () => {
        const { result } = makeHook()
        const pt = makePoint('p1')
        act(() => { result.current.openFeature(pt, 'points') })
        expect(result.current.displaySelectedFeature).toBe(pt)
    })
})
