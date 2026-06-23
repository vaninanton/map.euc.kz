import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useMetrikaPageViews } from './useMetrikaPageViews'

const { trackPageViewMock } = vi.hoisted(() => ({ trackPageViewMock: vi.fn() }))
vi.mock('@/lib/analytics', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/analytics')>()
    return { ...actual, trackPageView: trackPageViewMock }
})

/** Компонент, подключающий хук и навигирующий по заданным путям после монтирования. */
function Harness({ navigateTo }: { navigateTo?: string[] }) {
    useMetrikaPageViews()
    const navigate = useNavigate()
    useEffect(() => {
        navigateTo?.forEach((path) => {
            void navigate(path)
        })
    }, [navigate, navigateTo])
    return null
}

function renderAt(initial: string, navigateTo?: string[]) {
    return render(
        <MemoryRouter initialEntries={[initial]}>
            <Routes>
                <Route path="*" element={<Harness navigateTo={navigateTo} />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    trackPageViewMock.mockClear()
})

describe('useMetrikaPageViews', () => {
    it('не шлёт hit на первый рендер', () => {
        renderAt('/')
        expect(trackPageViewMock).not.toHaveBeenCalled()
    })

    it('шлёт hit на переход по SPA', () => {
        renderAt('/', ['/events'])
        expect(trackPageViewMock).toHaveBeenCalledWith('/events')
    })

    it('передаёт search и hash в url', () => {
        renderAt('/', ['/m/point/11?focus=1'])
        expect(trackPageViewMock).toHaveBeenCalledWith('/m/point/11?focus=1')
    })

    it('не шлёт hit на переход в админку', () => {
        renderAt('/', ['/admin/points'])
        expect(trackPageViewMock).not.toHaveBeenCalled()
    })
})
