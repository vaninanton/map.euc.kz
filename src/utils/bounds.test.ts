import { describe, expect, it } from 'vitest'
import { getFeatureBounds, getFeatureCenter } from '@/utils/bounds'
import type { Feature } from '@/types/geojson'

function pointFeature(lon: number, lat: number): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { id: '1', type: 'point', name: 'T' },
    }
}

function lineFeature(coords: [number, number][]): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { id: 'r1', type: 'route', name: 'R' },
    }
}

describe('bounds', () => {
    it('getFeatureCenter для Point возвращает координаты', () => {
        const f = pointFeature(76.95, 43.25)
        expect(getFeatureCenter(f)).toEqual([76.95, 43.25])
    })

    it('getFeatureCenter для LineString — середина по индексу', () => {
        const f = lineFeature([
            [0, 0],
            [10, 0],
            [20, 0],
        ])
        expect(getFeatureCenter(f)).toEqual([10, 0])
    })

    it('getFeatureBounds для Point расширяет bbox', () => {
        const f = pointFeature(10, 20)
        const [[swLon, swLat], [neLon, neLat]] = getFeatureBounds(f)
        expect(neLon - swLon).toBeCloseTo(0.002, 5)
        expect(neLat - swLat).toBeCloseTo(0.002, 5)
        expect(swLon).toBeLessThan(10)
        expect(neLon).toBeGreaterThan(10)
    })

    it('getFeatureBounds для LineString охватывает все вершины с паддингом', () => {
        const f = lineFeature([
            [76.0, 43.0],
            [77.0, 44.0],
        ])
        const [[swLon, swLat], [neLon, neLat]] = getFeatureBounds(f)
        expect(swLon).toBeLessThanOrEqual(76.0)
        expect(neLon).toBeGreaterThanOrEqual(77.0)
        expect(swLat).toBeLessThanOrEqual(43.0)
        expect(neLat).toBeGreaterThanOrEqual(44.0)
    })

    it('getFeatureCenter для пустой линии возвращает [0,0]', () => {
        const f: Feature = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: { id: 'e', type: 'route', name: 'E' },
        }
        expect(getFeatureCenter(f)).toEqual([0, 0])
        expect(getFeatureBounds(f)).toEqual([
            [0, 0],
            [0, 0],
        ])
    })
})
