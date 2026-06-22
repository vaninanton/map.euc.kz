import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fillMissingRouteElevations } from './fetchMissingRouteElevations'

type MockResponse = { ok: boolean; status?: number; body?: unknown }

function mockFetch(responses: MockResponse[]) {
    let call = 0
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
            const r: MockResponse = responses.at(call) ?? responses.at(-1) ?? { ok: false, status: 500 }
            call++
            return Promise.resolve({
                ok: r.ok,
                status: r.status ?? (r.ok ? 200 : 500),
                json: () => Promise.resolve(r.body),
            })
        }),
    )
}

function openMeteoOk(elevations: number[]) {
    return { ok: true, body: { elevation: elevations } }
}

beforeEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('fillMissingRouteElevations', () => {
    it('возвращает копию если все точки уже имеют высоту', async () => {
        const coords = [
            [76.9, 43.2, 700],
            [76.95, 43.25, 710],
        ] as [number, number, number][]
        const result = await fillMissingRouteElevations(coords)
        expect(result.coordinates).toEqual(coords)
        expect(result.coordinates).not.toBe(coords)
        expect(result.filled).toBe(0)
        expect(result.remaining).toBe(0)
    })

    it('заполняет высоты для точек без третьей координаты', async () => {
        mockFetch([openMeteoOk([650, 660])])
        const coords: [number, number][] = [
            [76.9, 43.2],
            [76.95, 43.25],
        ]
        const result = await fillMissingRouteElevations(coords)
        expect(result.coordinates[0]).toEqual([76.9, 43.2, 650])
        expect(result.coordinates[1]).toEqual([76.95, 43.25, 660])
        expect(result.filled).toBe(2)
        expect(result.remaining).toBe(0)
    })

    it('заполняет только точки без высоты, оставляет остальные', async () => {
        mockFetch([openMeteoOk([720])])
        const coords = [
            [76.9, 43.2, 700],
            [76.95, 43.25],
        ] as ([number, number] | [number, number, number])[]
        const result = await fillMissingRouteElevations(coords)
        expect(result.coordinates[0]).toEqual([76.9, 43.2, 700])
        expect(result.coordinates[1]).toEqual([76.95, 43.25, 720])
        expect(result.filled).toBe(1)
        expect(result.remaining).toBe(0)
    })

    it('при ошибке API (429) возвращает координаты без изменений', async () => {
        mockFetch([{ ok: false, status: 429 }])
        const coords: [number, number][] = [
            [76.9, 43.2],
            [76.95, 43.25],
        ]
        const result = await fillMissingRouteElevations(coords)
        expect(result.coordinates[0]).toEqual([76.9, 43.2])
        expect(result.coordinates[1]).toEqual([76.95, 43.25])
        expect(result.filled).toBe(0)
        expect(result.remaining).toBe(2)
    })

    it('при неожиданном формате ответа пропускает чанк', async () => {
        mockFetch([{ ok: true, body: { elevation: [1, 2, 3] } }])
        const coords: [number, number][] = [[76.9, 43.2]]
        const result = await fillMissingRouteElevations(coords)
        expect(result.filled).toBe(0)
        expect(result.remaining).toBe(1)
    })

    it('при некорректных значениях пропускает чанк', async () => {
        mockFetch([{ ok: true, body: { elevation: [null] } }])
        const coords: [number, number][] = [[76.9, 43.2]]
        const result = await fillMissingRouteElevations(coords)
        expect(result.filled).toBe(0)
        expect(result.remaining).toBe(1)
    })
})
