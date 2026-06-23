import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ymMock = vi.fn()
vi.mock('react-metrika', () => ({ ym: ymMock }))

/** Перезагружает модуль analytics с заданным значением VITE_YANDEX_METRIKA_ID. */
async function loadAnalytics(counterId: string | undefined) {
    vi.resetModules()
    if (counterId === undefined) {
        vi.stubEnv('VITE_YANDEX_METRIKA_ID', '')
    } else {
        vi.stubEnv('VITE_YANDEX_METRIKA_ID', counterId)
    }
    return import('./analytics')
}

beforeEach(() => {
    ymMock.mockClear()
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('metrikaCounterId / isMetrikaEnabled', () => {
    it('парсит валидный id', async () => {
        const a = await loadAnalytics('12345')
        expect(a.metrikaCounterId).toBe(12345)
        expect(a.isMetrikaEnabled).toBe(true)
    })

    it('даёт null при пустой переменной', async () => {
        const a = await loadAnalytics(undefined)
        expect(a.metrikaCounterId).toBeNull()
        expect(a.isMetrikaEnabled).toBe(false)
    })

    it('даёт null при некорректном/неположительном значении', async () => {
        expect((await loadAnalytics('abc')).metrikaCounterId).toBeNull()
        expect((await loadAnalytics('0')).metrikaCounterId).toBeNull()
        expect((await loadAnalytics('-5')).metrikaCounterId).toBeNull()
    })
})

describe('isAdminPath', () => {
    it('распознаёт админские пути', async () => {
        const { isAdminPath } = await loadAnalytics('1')
        expect(isAdminPath('/admin')).toBe(true)
        expect(isAdminPath('/admin/points')).toBe(true)
        expect(isAdminPath('/admin/route/5')).toBe(true)
    })

    it('не считает публичные пути админскими', async () => {
        const { isAdminPath } = await loadAnalytics('1')
        expect(isAdminPath('/')).toBe(false)
        expect(isAdminPath('/events')).toBe(false)
        expect(isAdminPath('/m/point/11')).toBe(false)
        expect(isAdminPath('/administrator')).toBe(false)
    })
})

describe('isStandaloneLaunch', () => {
    function stubMatchMedia(standalone: boolean) {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query === '(display-mode: standalone)' ? standalone : false,
        }))
    }

    afterEach(() => {
        vi.unstubAllGlobals()
        Reflect.deleteProperty(navigator, 'standalone')
    })

    it('true при display-mode: standalone', async () => {
        stubMatchMedia(true)
        const { isStandaloneLaunch } = await loadAnalytics('1')
        expect(isStandaloneLaunch()).toBe(true)
    })

    it('true при iOS navigator.standalone', async () => {
        stubMatchMedia(false)
        Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
        const { isStandaloneLaunch } = await loadAnalytics('1')
        expect(isStandaloneLaunch()).toBe(true)
    })

    it('false в обычной вкладке браузера', async () => {
        stubMatchMedia(false)
        const { isStandaloneLaunch } = await loadAnalytics('1')
        expect(isStandaloneLaunch()).toBe(false)
    })
})

describe('trackPageView', () => {
    it('шлёт hit при подключённом счётчике', async () => {
        const { trackPageView } = await loadAnalytics('777')
        trackPageView('/events')
        expect(ymMock).toHaveBeenCalledWith(777, 'hit', '/events')
    })

    it('no-op без счётчика', async () => {
        const { trackPageView } = await loadAnalytics(undefined)
        trackPageView('/events')
        expect(ymMock).not.toHaveBeenCalled()
    })

    it('не пробрасывает ошибку счётчика', async () => {
        ymMock.mockImplementationOnce(() => {
            throw new Error('boom')
        })
        const { trackPageView } = await loadAnalytics('1')
        expect(() => {
            trackPageView('/x')
        }).not.toThrow()
    })
})

describe('trackGoal', () => {
    it('шлёт reachGoal c параметрами', async () => {
        const { trackGoal } = await loadAnalytics('42')
        trackGoal('feature_open', { featureType: 'route' })
        expect(ymMock).toHaveBeenCalledWith(42, 'reachGoal', 'feature_open', { featureType: 'route' })
    })

    it('no-op без счётчика', async () => {
        const { trackGoal } = await loadAnalytics(undefined)
        trackGoal('share_app_link')
        expect(ymMock).not.toHaveBeenCalled()
    })

    it('не пробрасывает ошибку счётчика', async () => {
        ymMock.mockImplementationOnce(() => {
            throw new Error('boom')
        })
        const { trackGoal } = await loadAnalytics('1')
        expect(() => {
            trackGoal('share_telegram')
        }).not.toThrow()
    })
})
