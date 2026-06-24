import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    build2GISLink,
    buildAppShareLink,
    buildEventShareLink,
    buildTelegramEventMessage,
    buildTelegramPointMessage,
    buildTelegramShareLink,
    buildYandexLink,
    buildYandexRouteLink,
    build2GISRouteLink,
    buildGuruRouteLink,
    buildOpenRouteLink,
    copyToClipboard,
    getCoordsFromFeature,
    getCoordinatesArray,
    getViaPoints,
    resolveRouteViaPoints,
} from '@/utils/shareLinks'
import type { Feature } from '@/types/geojson'

describe('shareLinks smoke', () => {
    it('build2GISLink использует pedestrian/scooter в зависимости от mobile', () => {
        expect(build2GISLink(43.25, 76.95, false)).toContain('/pedestrian/')
        expect(build2GISLink(43.25, 76.95, true)).toContain('/scooter/')
    })

    it('getViaPoints возвращает промежуточные точки без первой и последней', () => {
        const points: [number, number][] = [
            [1, 1],
            [2, 2],
            [3, 3],
            [4, 4],
            [5, 5],
        ]
        const via = getViaPoints(points, 2)
        expect(via).toHaveLength(2)
        expect(via).not.toContainEqual([1, 1])
        expect(via).not.toContainEqual([5, 5])
    })

    it('buildGuruRouteLink включает start/finish и via параметры', () => {
        const url = buildGuruRouteLink([
            [76.9, 43.2],
            [76.91, 43.21],
            [76.92, 43.22],
            [76.93, 43.23],
        ])
        expect(url.startsWith('guru://nav?')).toBe(true)
        expect(url).toContain('start=')
        expect(url).toContain('finish=')
        expect(url).toContain('via=')
    })

    it('resolveRouteViaPoints использует явные via в приоритете', () => {
        const coordinates: [number, number][] = [
            [76.9, 43.2],
            [76.91, 43.21],
            [76.92, 43.22],
            [76.93, 43.23],
        ]
        const explicitVia: [number, number][] = [[76.92, 43.22]]
        expect(resolveRouteViaPoints(coordinates, explicitVia, 4)).toEqual(explicitVia)
    })

    it('buildOpenRouteLink использует явные via', () => {
        const coordinates: [number, number][] = [
            [76.9, 43.2],
            [76.91, 43.21],
            [76.92, 43.22],
            [76.93, 43.23],
        ]
        const url = buildOpenRouteLink(coordinates, [[76.92, 43.22]])
        expect(decodeURIComponent(url)).toContain('43.22,76.92')
    })

    it('buildYandexRouteLink строит rtext как start~via~finish', () => {
        const coordinates: [number, number][] = [
            [76.9, 43.2],
            [76.91, 43.21],
            [76.93, 43.23],
        ]
        const url = buildYandexRouteLink(coordinates, [[76.91, 43.21]])
        expect(url).toContain('yandex.ru/maps')
        expect(url).toContain('rtt=bc')
        expect(url).toContain('rtext=43.2,76.9~43.21,76.91~43.23,76.93')
    })

    it('build2GISRouteLink строит points как start|via|finish', () => {
        const coordinates: [number, number][] = [
            [76.9, 43.2],
            [76.91, 43.21],
            [76.93, 43.23],
        ]
        const url = build2GISRouteLink(coordinates, false, [[76.91, 43.21]])
        expect(url).toContain('/directions/tab/pedestrian/points/')
        expect(url).toContain('/points/76.9,43.2|76.91,43.21|76.93,43.23')
    })

    it('buildOpenRouteLink возвращает пустую строку для короткого маршрута', () => {
        expect(buildOpenRouteLink([])).toBe('')
        expect(buildOpenRouteLink([[76.9, 43.2]])).toBe('')
    })

    it('формирует telegram-сообщение и ссылку для шаринга точки', () => {
        const shareUrl = 'https://map.euc.kz/#point=abc'
        const message = buildTelegramPointMessage('Парк первого президента')
        expect(message).toContain('Парк первого президента')

        const link = buildTelegramShareLink(shareUrl, message)
        expect(link.startsWith('https://t.me/share/url?')).toBe(true)
        expect(link).toContain('url=')
        expect(link).toContain('text=')
    })
})

describe('shareLinks координаты и ссылки приложения', () => {
    const point: Feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.95, 43.25] },
        properties: { id: '1', type: 'point', name: 'P' },
    }

    const route: Feature = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [
                [76.9, 43.2],
                [76.91, 43.21],
            ],
        },
        properties: { id: 'r', type: 'route', name: 'R' },
    }

    it('getCoordsFromFeature для Point и LineString', () => {
        expect(getCoordsFromFeature(point)).toEqual({ lon: 76.95, lat: 43.25 })
        expect(getCoordsFromFeature(route)).toEqual({ lon: 76.9, lat: 43.2 })
    })

    it('getCoordinatesArray', () => {
        expect(getCoordinatesArray(point)).toEqual([[76.95, 43.25]])
        expect(getCoordinatesArray(route)).toEqual([
            [76.9, 43.2],
            [76.91, 43.21],
        ])
    })

    it('buildYandexLink подставляет lat,lon в rtext', () => {
        const url = buildYandexLink(43.25, 76.95)
        expect(url).toContain('43.25')
        expect(url).toContain('76.95')
        expect(url).toContain('yandex.ru/maps')
    })

    it('buildAppShareLink собирает origin, base и путь deep-link /m/…', () => {
        vi.stubGlobal('window', {
            location: {
                origin: 'https://map.euc.kz',
            },
        })
        const base = import.meta.env.BASE_URL
        expect(buildAppShareLink('route', 'abc 1')).toBe(
            `https://map.euc.kz${base.endsWith('/') ? base : `${base}/`}m/route/abc%201`,
        )
        vi.unstubAllGlobals()
    })

    it('buildEventShareLink собирает origin, base и путь /events/:id с encode', () => {
        vi.stubGlobal('window', {
            location: {
                origin: 'https://map.euc.kz',
            },
        })
        const base = import.meta.env.BASE_URL
        expect(buildEventShareLink('e 7')).toBe(
            `https://map.euc.kz${base.endsWith('/') ? base : `${base}/`}events/e%207`,
        )
        vi.unstubAllGlobals()
    })

    it('buildTelegramEventMessage возвращает заголовок события', () => {
        expect(buildTelegramEventMessage('Покатушка')).toBe('Покатушка')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })
})

describe('copyToClipboard', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('копирует URL в буфер обмена', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', {
            clipboard: { writeText },
        })
        const ok = await copyToClipboard('https://map.test/#point=1')
        expect(ok).toBe(true)
        expect(writeText).toHaveBeenCalledWith('https://map.test/#point=1')
    })

    it('при ошибке копирования возвращает false', async () => {
        vi.stubGlobal('navigator', {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        })
        const ok = await copyToClipboard('https://x')
        expect(ok).toBe(false)
    })
})
