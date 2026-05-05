import { describe, expect, it } from 'vitest'
import { routeVertexElevationStats, type RouteVertexCoord } from '@/utils/routeVertexElevationStats'

describe('routeVertexElevationStats', () => {
    it('пустой массив', () => {
        expect(routeVertexElevationStats([])).toEqual({
            vertexCount: 0,
            withElevationCount: 0,
            withoutElevationCount: 0,
        })
    })

    it('только без высоты', () => {
        const coords: RouteVertexCoord[] = [
            [0, 0],
            [1, 1],
        ]
        expect(routeVertexElevationStats(coords)).toEqual({
            vertexCount: 2,
            withElevationCount: 0,
            withoutElevationCount: 2,
        })
    })

    it('смешанный набор', () => {
        const coords: RouteVertexCoord[] = [
            [0, 0, 100],
            [1, 1],
            [2, 2, 200],
        ]
        expect(routeVertexElevationStats(coords)).toEqual({
            vertexCount: 3,
            withElevationCount: 2,
            withoutElevationCount: 1,
        })
    })
})
