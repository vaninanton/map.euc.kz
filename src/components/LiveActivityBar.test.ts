import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActiveRiders } from '@/utils/telegramRiders'
import type { FeatureCollection } from '@/types/geojson'

const TTL_MINUTES = 60
const TTL_MS = TTL_MINUTES * 60 * 1000

function makeGeo(
    riders: Array<{
        telegramUserId: number
        lon: number
        lat: number
        updatedAt: string
    }>,
): FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: riders.map((r) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
            properties: {
                id: `telegram-user-${String(r.telegramUserId)}`,
                name: `User ${String(r.telegramUserId)}`,
                type: 'telegramUser',
                telegramUserId: r.telegramUserId,
                updatedAt: r.updatedAt,
            },
        })),
    }
}

describe('getActiveRiders', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('возвращает пустой массив при null', () => {
        expect(getActiveRiders(null)).toEqual([])
    })

    it('возвращает пустой массив при пустой коллекции', () => {
        expect(getActiveRiders({ type: 'FeatureCollection', features: [] })).toEqual([])
    })

    it('включает свежего райдера', () => {
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', String(TTL_MINUTES))
        const now = Date.now()
        const geo = makeGeo([
            { telegramUserId: 1, lon: 76.9, lat: 43.2, updatedAt: new Date(now - 1000).toISOString() },
        ])
        const riders = getActiveRiders(geo)
        expect(riders).toHaveLength(1)
        expect(riders[0]).toMatchObject({ telegramUserId: 1, lon: 76.9, lat: 43.2 })
    })

    it('исключает просроченного райдера (updatedAt > TTL)', () => {
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', String(TTL_MINUTES))
        const now = Date.now()
        const geo = makeGeo([
            {
                telegramUserId: 2,
                lon: 76.9,
                lat: 43.2,
                updatedAt: new Date(now - TTL_MS - 1000).toISOString(),
            },
        ])
        expect(getActiveRiders(geo)).toHaveLength(0)
    })

    it('граничный случай: updatedAt ровно на TTL — исключается', () => {
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', String(TTL_MINUTES))
        const now = Date.now()
        const geo = makeGeo([
            {
                telegramUserId: 3,
                lon: 76.9,
                lat: 43.2,
                updatedAt: new Date(now - TTL_MS).toISOString(),
            },
        ])
        expect(getActiveRiders(geo)).toHaveLength(0)
    })

    it('смешивает свежих и просроченных — возвращает только свежих', () => {
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', String(TTL_MINUTES))
        const now = Date.now()
        const geo = makeGeo([
            { telegramUserId: 10, lon: 76.9, lat: 43.2, updatedAt: new Date(now - 5 * 60 * 1000).toISOString() },
            { telegramUserId: 11, lon: 76.91, lat: 43.21, updatedAt: new Date(now - TTL_MS - 1000).toISOString() },
            { telegramUserId: 12, lon: 76.92, lat: 43.22, updatedAt: new Date(now - 10 * 60 * 1000).toISOString() },
        ])
        const riders = getActiveRiders(geo)
        expect(riders).toHaveLength(2)
        expect(riders.map((r) => r.telegramUserId)).toEqual(expect.arrayContaining([10, 12]))
    })

    it('игнорирует фичи не типа telegramUser', () => {
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', String(TTL_MINUTES))
        const now = Date.now()
        const geo: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [76.9, 43.2] },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- тест намеренно смешивает типы
                    properties: { id: 'p1', name: 'Точка', type: 'point' } as any,
                },
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [76.91, 43.21] },
                    properties: {
                        id: 'telegram-user-99',
                        name: 'User 99',
                        type: 'telegramUser',
                        telegramUserId: 99,
                        updatedAt: new Date(now - 1000).toISOString(),
                    },
                },
            ],
        }
        const riders = getActiveRiders(geo)
        expect(riders).toHaveLength(1)
        expect(riders[0]?.telegramUserId).toBe(99)
    })

    it('игнорирует фичи с некорректным updatedAt', () => {
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', String(TTL_MINUTES))
        const geo = makeGeo([{ telegramUserId: 5, lon: 76.9, lat: 43.2, updatedAt: 'не-дата' }])
        expect(getActiveRiders(geo)).toHaveLength(0)
    })
})
