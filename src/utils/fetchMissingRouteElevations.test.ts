import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fillMissingRouteElevations } from './fetchMissingRouteElevations'

function mockFetchOk(elevations: number[]) {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ elevation: elevations }),
        }),
    )
}

beforeEach(() => {
    vi.unstubAllGlobals()
})

describe('fillMissingRouteElevations', () => {
    it('возвращает копию если все точки уже имеют высоту', async () => {
        const coords = [[76.9, 43.2, 700], [76.95, 43.25, 710]] as [number, number, number][]
        const result = await fillMissingRouteElevations(coords)
        expect(result).toEqual(coords)
        expect(result).not.toBe(coords)
    })

    it('заполняет высоты для точек без третьей координаты', async () => {
        mockFetchOk([650, 660])
        const coords: [number, number][] = [[76.9, 43.2], [76.95, 43.25]]
        const result = await fillMissingRouteElevations(coords)
        expect(result[0]).toEqual([76.9, 43.2, 650])
        expect(result[1]).toEqual([76.95, 43.25, 660])
    })

    it('заполняет только точки без высоты, оставляет остальные', async () => {
        mockFetchOk([720])
        const coords = [[76.9, 43.2, 700], [76.95, 43.25]] as ([number, number] | [number, number, number])[]
        const result = await fillMissingRouteElevations(coords)
        expect(result[0]).toEqual([76.9, 43.2, 700])
        expect(result[1]).toEqual([76.95, 43.25, 720])
    })

    it('бросает ошибку при неуспешном ответе API', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 503 }),
        )
        await expect(fillMissingRouteElevations([[76.9, 43.2]])).rejects.toThrow('503')
    })

    it('бросает ошибку при неожиданном формате ответа', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ elevation: [1, 2, 3] }),
            }),
        )
        await expect(fillMissingRouteElevations([[76.9, 43.2]])).rejects.toThrow('неожиданный ответ')
    })

    it('бросает ошибку при некорректных значениях высоты', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ elevation: [null] }),
            }),
        )
        await expect(fillMissingRouteElevations([[76.9, 43.2]])).rejects.toThrow('некорректные значения')
    })
})
