import { describe, expect, it } from 'vitest'
import { simplifyRouteCollinear, type RouteEditorCoord } from '@/utils/simplifyRouteCollinear'

describe('simplifyRouteCollinear', () => {
    it('не меняет 0–2 точки', () => {
        expect(simplifyRouteCollinear([])).toEqual([])
        expect(simplifyRouteCollinear([[0, 0]])).toEqual([[0, 0]])
        expect(
            simplifyRouteCollinear([
                [1, 1],
                [2, 2],
            ]),
        ).toEqual([
            [1, 1],
            [2, 2],
        ])
    })

    it('убирает одну среднюю коллинеарную точку на отрезке', () => {
        const r = simplifyRouteCollinear([
            [0, 0],
            [1, 0],
            [2, 0],
        ])
        expect(r).toEqual([
            [0, 0],
            [2, 0],
        ])
    })

    it('убирает цепочку коллинеарных промежуточных', () => {
        const r = simplifyRouteCollinear([
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
        ])
        expect(r).toEqual([
            [0, 0],
            [3, 0],
        ])
    })

    it('сохраняет излом', () => {
        const orig: RouteEditorCoord[] = [
            [0, 0],
            [1, 0],
            [1, 1],
            [2, 1],
        ]
        expect(simplifyRouteCollinear(orig)).toEqual(orig)
    })

    it('сохраняет третью точку если средняя не на отрезке (продолжение)', () => {
        const orig: RouteEditorCoord[] = [
            [0, 0],
            [2, 0],
            [1, 0],
        ]
        expect(simplifyRouteCollinear(orig)).toEqual(orig)
    })

    it('копирует высоту у сохранённых вершин', () => {
        const r = simplifyRouteCollinear([
            [0, 0, 10],
            [1, 0, 20],
            [2, 0, 30],
        ])
        expect(r).toEqual([
            [0, 0, 10],
            [2, 0, 30],
        ])
    })
})
