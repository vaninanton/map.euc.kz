import { describe, it, expect } from 'vitest'
import { filterPoints } from '@/utils/pointFilters'
import type { PointFeature } from '@/types/geojson'

const createMockPoint = (
    id: string,
    name: string,
    description: string | null,
    isMeeting: boolean = false,
    hasSocket: boolean = false,
    isErlan: boolean = false,
): PointFeature => {
    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [0, 0],
        },
        properties: {
            id,
            name,
            description,
            type: 'point',
            isMeeting,
            hasSocket,
            isErlan,
        },
    }
}

const createMockSocket = (
    id: string,
    name: string,
    description: string | null,
    isErlan: boolean = false,
): PointFeature => {
    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [0, 0],
        },
        properties: {
            id,
            name,
            description,
            type: 'socket',
            isErlan,
        },
    }
}

describe('pointFilters', () => {
    const mockPoints: PointFeature[] = [
        createMockPoint('p1', 'Мега', 'Возле входа', true, false, false),
        createMockPoint('p2', 'Парк', 'Тихое место с розеткой', false, true, false),
        createMockPoint('p3', 'Точка Ерландии', 'Скрытая точка', true, true, true),
        createMockSocket('s1', 'Заправка', 'Быстрая зарядка', false),
        createMockSocket('s2', 'ТЦ', 'Бесплатная розетка Ерландии', true),
    ]

    it('should filter by search query (name or description)', () => {
        const result1 = filterPoints(mockPoints, {
            searchQuery: 'розетк',
            typeFilter: 'all',
            onlyMeeting: false,
            onlySocket: false,
            onlyErlan: false,
        })
        expect(result1).toHaveLength(2) // p2 ("розеткой"), s2 ("розетка")
        expect(result1.map((p) => p.properties.id)).toEqual(['p2', 's2'])

        const result2 = filterPoints(mockPoints, {
            searchQuery: 'Мега',
            typeFilter: 'all',
            onlyMeeting: false,
            onlySocket: false,
            onlyErlan: false,
        })
        expect(result2).toHaveLength(1)
        expect(result2[0].properties.id).toBe('p1')
    })

    it('should filter by typeFilter', () => {
        const resultPoints = filterPoints(mockPoints, {
            searchQuery: '',
            typeFilter: 'point',
            onlyMeeting: false,
            onlySocket: false,
            onlyErlan: false,
        })
        expect(resultPoints).toHaveLength(3)
        expect(resultPoints.map((p) => p.properties.id)).toEqual(['p1', 'p2', 'p3'])

        const resultSockets = filterPoints(mockPoints, {
            searchQuery: '',
            typeFilter: 'socket',
            onlyMeeting: false,
            onlySocket: false,
            onlyErlan: false,
        })
        expect(resultSockets).toHaveLength(2)
        expect(resultSockets.map((p) => p.properties.id)).toEqual(['s1', 's2'])
    })

    it('should filter by onlyMeeting flag', () => {
        const resultMeeting = filterPoints(mockPoints, {
            searchQuery: '',
            typeFilter: 'all',
            onlyMeeting: true,
            onlySocket: false,
            onlyErlan: false,
        })
        expect(resultMeeting).toHaveLength(2)
        expect(resultMeeting.map((p) => p.properties.id)).toEqual(['p1', 'p3']) // only p1, p3 have isMeeting=true
    })

    it('should filter by onlySocket flag', () => {
        const resultSocket = filterPoints(mockPoints, {
            searchQuery: '',
            typeFilter: 'all',
            onlyMeeting: false,
            onlySocket: true,
            onlyErlan: false,
        })
        expect(resultSocket).toHaveLength(4)
        // Sockets have sockets naturally (s1, s2). Points with hasSocket=true (p2, p3).
        expect(resultSocket.map((p) => p.properties.id)).toEqual(['p2', 'p3', 's1', 's2'])
    })

    it('should filter by onlyErlan flag', () => {
        const resultErlan = filterPoints(mockPoints, {
            searchQuery: '',
            typeFilter: 'all',
            onlyMeeting: false,
            onlySocket: false,
            onlyErlan: true,
        })
        expect(resultErlan).toHaveLength(2)
        expect(resultErlan.map((p) => p.properties.id)).toEqual(['p3', 's2'])
    })

    it('should handle combined filters', () => {
        const result = filterPoints(mockPoints, {
            searchQuery: 'точка', // 'Точка Ерландии' (p3)
            typeFilter: 'point', // p3 is point
            onlyMeeting: true, // p3 is meeting
            onlySocket: true, // p3 has socket
            onlyErlan: true, // p3 is erlan
        })
        expect(result).toHaveLength(1)
        expect(result[0].properties.id).toBe('p3')
    })
})
