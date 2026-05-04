import { describe, expect, it } from 'vitest'
import { bearingDegrees, haversineKm, radarNormalizedRadius } from '@/utils/geoMath'

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

describe('radarNormalizedRadius', () => {
  it('0 км → 0', () => {
    expect(radarNormalizedRadius(0)).toBe(0)
  })

  it('10 км и больше → 1', () => {
    expect(radarNormalizedRadius(10)).toBeCloseTo(1, 5)
    expect(radarNormalizedRadius(100)).toBeCloseTo(1, 5)
  })
})
