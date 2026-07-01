import { describe, expect, it } from 'vitest'
import { routeDistanceKm, totalRoutesDistanceKm } from '@/admin/utils/routeDistance'

// ~0.9 км на 0.01° долготы на широте Алматы (43.2°)
const A: [number, number] = [76.9, 43.2]
const B: [number, number] = [76.91, 43.2]

describe('routeDistanceKm', () => {
    it('возвращает 0 для маршрута из одной вершины', () => {
        expect(routeDistanceKm({ coordinates: [A] })).toBe(0)
    })

    it('считает длину сегмента по haversine', () => {
        const km = routeDistanceKm({ coordinates: [A, B] })
        expect(km).toBeGreaterThan(0.7)
        expect(km).toBeLessThan(1)
    })

    it('игнорирует высоту в вершинах [lng, lat, z]', () => {
        const flat = routeDistanceKm({ coordinates: [A, B] })
        const withZ = routeDistanceKm({
            coordinates: [
                [...A, 800],
                [...B, 900],
            ],
        })
        expect(withZ).toBeCloseTo(flat, 10)
    })

    it('суммирует несколько сегментов', () => {
        const one = routeDistanceKm({ coordinates: [A, B] })
        const two = routeDistanceKm({ coordinates: [A, B, A] })
        expect(two).toBeCloseTo(one * 2, 10)
    })
})

describe('totalRoutesDistanceKm', () => {
    it('пустой список — 0', () => {
        expect(totalRoutesDistanceKm([])).toBe(0)
    })

    it('складывает длины всех маршрутов', () => {
        const one = routeDistanceKm({ coordinates: [A, B] })
        const total = totalRoutesDistanceKm([{ coordinates: [A, B] }, { coordinates: [A, B] }])
        expect(total).toBeCloseTo(one * 2, 10)
    })
})
