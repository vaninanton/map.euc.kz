import { describe, expect, it } from 'vitest'
import { bearingDegrees, haversineKm, radarLinearScaleMax, radarNormalizedRadiusLog } from '@/utils/geoMath'

/** Париж */
const P_LAT = 48.8566
const P_LON = 2.3522

/** Лондон */
const L_LAT = 51.5074
const L_LON = -0.1278

describe('haversineKm', () => {
    it('возвращает ожидаемое расстояние Париж — Лондон (допуск)', () => {
        const km = haversineKm(P_LAT, P_LON, L_LAT, L_LON)
        expect(km).toBeGreaterThan(330)
        expect(km).toBeLessThan(360)
    })

    it('нулевое расстояние для совпадающих точек', () => {
        expect(haversineKm(P_LAT, P_LON, P_LAT, P_LON)).toBe(0)
    })
})

describe('bearingDegrees', () => {
    it('азимут Париж → Лондон в ожидаемом диапазоне', () => {
        const b = bearingDegrees(P_LAT, P_LON, L_LAT, L_LON)
        expect(b).toBeGreaterThan(300)
        expect(b).toBeLessThan(350)
    })

    it('на север азимут ~0°', () => {
        const b = bearingDegrees(0, 0, 1, 0)
        expect(b).toBeCloseTo(0, 1)
    })

    it('на восток азимут ~90°', () => {
        const b = bearingDegrees(0, 0, 0, 1)
        expect(b).toBeCloseTo(90, 0)
    })
})

describe('radarNormalizedRadiusLog', () => {
    it('0 км → 0', () => {
        expect(radarNormalizedRadiusLog(0)).toBe(0)
    })

    it('10 км (макс) → 1', () => {
        expect(radarNormalizedRadiusLog(10)).toBeCloseTo(1, 5)
    })

    it('значения сверх макс зажаты до 1', () => {
        expect(radarNormalizedRadiusLog(100)).toBeCloseTo(1, 5)
    })

    it('монотонно возрастает', () => {
        const vals = [0.5, 1, 2, 5, 10].map(radarNormalizedRadiusLog)
        for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThan(vals[i - 1])
    })
})

describe('radarLinearScaleMax', () => {
    it('округляет до красивого числа вверх', () => {
        expect(radarLinearScaleMax(0.3)).toBe(0.5)
        expect(radarLinearScaleMax(1.1)).toBe(2)
        expect(radarLinearScaleMax(3.5)).toBe(5)
        expect(radarLinearScaleMax(7)).toBe(10)
        expect(radarLinearScaleMax(12)).toBe(20)
        expect(radarLinearScaleMax(55)).toBe(100)
    })

    it('нулевой вход → 0.5', () => {
        expect(radarLinearScaleMax(0)).toBe(0.5)
    })

    it('результат всегда >= входного значения', () => {
        for (const km of [0.1, 1, 2.5, 4.9, 9.9, 100]) {
            expect(radarLinearScaleMax(km)).toBeGreaterThanOrEqual(km)
        }
    })
})
