import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeatureIndexes } from './useFeatureIndexes'
import type { Feature, FeatureCollection } from '@/types/geojson'

function makeCollection(features: FeatureCollection['features']): FeatureCollection {
    return { type: 'FeatureCollection', features }
}

function makePoint(id: string, type: Feature['properties']['type'] = 'point'): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- минимальные тестовые данные для индексирования
        properties: { id, type, name: id } as any,
    }
}

function makeRoute(id: string): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[76.9, 43.2], [76.95, 43.25]] },
        properties: { id, type: 'route', name: id },
    }
}

describe('useFeatureIndexes', () => {
    it('возвращает пустые индексы при null коллекциях', () => {
        const { result } = renderHook(() => useFeatureIndexes(null, null, null, null))
        expect(result.current.pointsById.size).toBe(0)
        expect(result.current.routesById.size).toBe(0)
        expect(result.current.bikeLanesById.size).toBe(0)
        expect(result.current.telegramUsersById.size).toBe(0)
    })

    it('индексирует точки по id с префиксом all: и type:', () => {
        const geo = makeCollection([makePoint('p1', 'point'), makePoint('p2', 'socket')])
        const { result } = renderHook(() => useFeatureIndexes(geo, null, null, null))
        expect(result.current.pointsById.has('all:p1')).toBe(true)
        expect(result.current.pointsById.has('point:p1')).toBe(true)
        expect(result.current.pointsById.has('socket:p2')).toBe(true)
        expect(result.current.pointsById.size).toBe(4)
    })

    it('индексирует маршруты по id', () => {
        const geo = makeCollection([makeRoute('r1'), makeRoute('r2')])
        const { result } = renderHook(() => useFeatureIndexes(null, geo, null, null))
        expect(result.current.routesById.has('r1')).toBe(true)
        expect(result.current.routesById.has('r2')).toBe(true)
    })

    it('индексирует велодорожки', () => {
        const geo = makeCollection([makeRoute('bl1')])
        const { result } = renderHook(() => useFeatureIndexes(null, null, geo, null))
        expect(result.current.bikeLanesById.has('bl1')).toBe(true)
    })

    it('индексирует telegram-пользователей', () => {
        const geo = makeCollection([makePoint('tg1', 'telegramUser')])
        const { result } = renderHook(() => useFeatureIndexes(null, null, null, geo))
        expect(result.current.telegramUsersById.has('tg1')).toBe(true)
    })

    it('стабильная ссылка на индекс если коллекция не изменилась', () => {
        const geo = makeCollection([makeRoute('r1')])
        const { result, rerender } = renderHook(() => useFeatureIndexes(null, geo, null, null))
        const before = result.current.routesById
        rerender()
        expect(result.current.routesById).toBe(before)
    })
})
