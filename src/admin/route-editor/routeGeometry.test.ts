import { describe, expect, it } from 'vitest'
import {
    findInsertIndexAndPoint,
    insertVertexAtIndex,
    removeVertexAtIndex,
    updateVertexLngLat,
    toLineStringCoords,
} from '@/admin/route-editor/routeGeometry'

describe('routeGeometry', () => {
    it('toLineStringCoords отбрасывает высоту', () => {
        expect(
            toLineStringCoords([
                [1, 2, 100],
                [3, 4, 200],
            ]),
        ).toEqual([
            [1, 2],
            [3, 4],
        ])
    })

    it('findInsertIndexAndPoint находит сегмент ближе всего к клику', () => {
        const line: [number, number][] = [
            [0, 0],
            [10, 0],
        ]
        const found = findInsertIndexAndPoint(line, [5, 1])
        expect(found?.insertIndex).toBe(1)
        expect(found?.point[0]).toBeCloseTo(5)
        expect(found?.point[1]).toBeCloseTo(0)
    })

    it('insertVertexAtIndex вставляет точку', () => {
        const next = insertVertexAtIndex(
            [
                [0, 0],
                [10, 0],
            ],
            1,
            [5, 0],
        )
        expect(next).toHaveLength(3)
        expect(next[1]).toEqual([5, 0])
    })

    it('removeVertexAtIndex не опускается ниже двух вершин', () => {
        const base: [[number, number], [number, number]] = [
            [0, 0],
            [1, 1],
        ]
        expect(removeVertexAtIndex(base, 0)).toEqual(base)
    })

    it('updateVertexLngLat сохраняет высоту', () => {
        const next = updateVertexLngLat([[0, 0, 10]], 0, 2, 3)
        expect(next[0]).toEqual([2, 3, 10])
    })
})
