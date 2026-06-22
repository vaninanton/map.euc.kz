import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    HASH_TYPE_TO_LAYER_KEY,
    LAYER_KEY_TO_HASH_TYPE,
    buildHash,
    buildMapDeepLinkPath,
    clearHash,
    parseHash,
    parseMapDeepLinkPathname,
    setHash,
} from '@/utils/hashNav'
import type { LayerKey } from '@/constants'

describe('hashNav', () => {
    it('парсит валидный hash с нормализацией регистра типа', () => {
        expect(parseHash('BikeLane=alm84')).toEqual({ type: 'bikeLane', id: 'alm84' })
    })

    it('парсит telegramUser', () => {
        expect(parseHash('telegramUser=42')).toEqual({ type: 'telegramUser', id: '42' })
    })

    it('корректно декодирует id из hash', () => {
        expect(parseHash('route=abc%20123')).toEqual({ type: 'route', id: 'abc 123' })
    })

    it('возвращает null для невалидных строк', () => {
        expect(parseHash('')).toBeNull()
        expect(parseHash('unknown=1')).toBeNull()
        expect(parseHash('point=')).toBeNull()
        expect(parseHash('point')).toBeNull()
    })

    it('строит hash с encodeURIComponent', () => {
        expect(buildHash('socket', 'id with space')).toBe('socket=id%20with%20space')
    })

    it('HASH_TYPE_TO_LAYER_KEY обратен LAYER_KEY_TO_HASH_TYPE для всех слоёв', () => {
        const keys: LayerKey[] = ['points', 'sockets', 'routes', 'bikeLanes', 'telegramUsers']
        for (const key of keys) {
            const hashType = LAYER_KEY_TO_HASH_TYPE[key]
            expect(HASH_TYPE_TO_LAYER_KEY[hashType]).toBe(key)
        }
    })

    it('buildMapDeepLinkPath и parseMapDeepLinkPathname — обратимы', () => {
        expect(buildMapDeepLinkPath('route', 'abc 1')).toBe('m/route/abc%201')
        expect(parseMapDeepLinkPathname('/m/route/abc%201')).toEqual({ type: 'route', id: 'abc 1' })
        expect(parseMapDeepLinkPathname('/m/bikelane/alm84')).toEqual({ type: 'bikeLane', id: 'alm84' })
        expect(parseMapDeepLinkPathname('/admin/points')).toBeNull()
        expect(parseMapDeepLinkPathname('/')).toBeNull()
    })
})

describe('setHash / clearHash', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('setHash вызывает replaceState с новым hash', () => {
        const replaceState = vi.fn()
        vi.stubGlobal('window', {
            location: { href: 'https://map.test/app/page?q=1' },
            history: { replaceState },
        })
        setHash('point', '99')
        expect(replaceState).toHaveBeenCalledTimes(1)
        const arg = replaceState.mock.calls[0][2] as string
        expect(arg).toContain('#point=99')
    })

    it('clearHash убирает hash из URL', () => {
        const replaceState = vi.fn()
        vi.stubGlobal('window', {
            location: { href: 'https://map.test/app/#point=1' },
            history: { replaceState },
        })
        clearHash()
        expect(replaceState).toHaveBeenCalled()
        const arg = replaceState.mock.calls[0][2] as string
        expect(arg.endsWith('#')).toBe(false)
        expect(arg.includes('#point')).toBe(false)
    })
})
