import { describe, it, expect } from 'vitest'
import { filterRoutes } from '@/utils/routeFilters'
import type { RouteWithStats } from '@/utils/routeFilters'
import type { RouteFeature } from '@/types/geojson'

const createMockRoute = (
    id: string,
    name: string,
    description: string | null,
    distance: number | undefined,
    isErlan: boolean | undefined,
    distanceKm: number,
    ascentM: number,
): RouteWithStats => {
    const feature: RouteFeature = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [],
        },
        properties: {
            id,
            name,
            description,
            type: 'route',
            distance,
            isErlan,
        },
    }

    return {
        feature,
        stats: {
            distanceKm,
            ascentM,
            descentM: ascentM,
        },
    }
}

describe('routeFilters', () => {
    const mockRoutes: RouteWithStats[] = [
        createMockRoute('r1', 'Көк-Төбе', 'Красивый подъем на гору', undefined, false, 5.5, 300),
        createMockRoute('r2', 'БАО', 'Тяжелый подъем', 15.0, true, 15.0, 800),
        createMockRoute('r3', 'Терренкур', 'Прогулочный плоский маршрут', undefined, false, 8.0, 50),
        createMockRoute('r4', 'Капчагайская трасса', 'Длинный плоский заезд', 60.0, false, 60.0, 80),
    ]

    it('should filter by search query (name or description)', () => {
        const result1 = filterRoutes(mockRoutes, {
            searchQuery: 'подъем',
            distanceRange: 'all',
            ascentRange: 'all',
            onlyErlan: false,
        })
        expect(result1).toHaveLength(2)
        expect(result1.map((r) => r.feature.properties.id)).toEqual(['r1', 'r2'])

        const result2 = filterRoutes(mockRoutes, {
            searchQuery: 'Көк',
            distanceRange: 'all',
            ascentRange: 'all',
            onlyErlan: false,
        })
        expect(result2).toHaveLength(1)
        expect(result2[0].feature.properties.id).toBe('r1')
    })

    it('should filter by distance range', () => {
        // under10
        const resultUnder10 = filterRoutes(mockRoutes, {
            searchQuery: '',
            distanceRange: 'under10',
            ascentRange: 'all',
            onlyErlan: false,
        })
        expect(resultUnder10).toHaveLength(2)
        expect(resultUnder10.map((r) => r.feature.properties.id)).toEqual(['r1', 'r3'])

        // 10to25
        const result10to25 = filterRoutes(mockRoutes, {
            searchQuery: '',
            distanceRange: '10to25',
            ascentRange: 'all',
            onlyErlan: false,
        })
        expect(result10to25).toHaveLength(1)
        expect(result10to25[0].feature.properties.id).toBe('r2')

        // over50
        const resultOver50 = filterRoutes(mockRoutes, {
            searchQuery: '',
            distanceRange: 'over50',
            ascentRange: 'all',
            onlyErlan: false,
        })
        expect(resultOver50).toHaveLength(1)
        expect(resultOver50[0].feature.properties.id).toBe('r4')
    })

    it('should filter by ascent range', () => {
        // flat
        const resultFlat = filterRoutes(mockRoutes, {
            searchQuery: '',
            distanceRange: 'all',
            ascentRange: 'flat',
            onlyErlan: false,
        })
        expect(resultFlat).toHaveLength(2)
        expect(resultFlat.map((r) => r.feature.properties.id)).toEqual(['r3', 'r4'])

        // mountain
        const resultMountain = filterRoutes(mockRoutes, {
            searchQuery: '',
            distanceRange: 'all',
            ascentRange: 'mountain',
            onlyErlan: false,
        })
        expect(resultMountain).toHaveLength(1)
        expect(resultMountain[0].feature.properties.id).toBe('r2')
    })

    it('should filter by onlyErlan flag', () => {
        const resultErlan = filterRoutes(mockRoutes, {
            searchQuery: '',
            distanceRange: 'all',
            ascentRange: 'all',
            onlyErlan: true,
        })
        expect(resultErlan).toHaveLength(1)
        expect(resultErlan[0].feature.properties.id).toBe('r2')
    })
})
