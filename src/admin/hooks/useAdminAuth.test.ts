import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'

// Управляемый мок supabase: захватываем колбэк onAuthStateChange, чтобы
// эмитить события auth вручную, и считаем запросы к map_admin_users.
// vi.hoisted — фабрика vi.mock поднимается над объявлениями const.
const { maybeSingle, from, unsubscribe, onAuthStateChange, getAuthCallback } = vi.hoisted(() => {
    const maybeSingle = vi.fn()
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    const unsubscribe = vi.fn()
    let authCallback: ((event: string, session: unknown) => void) | null = null
    const onAuthStateChange = vi.fn((cb: (event: string, session: unknown) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe } } }
    })
    return { maybeSingle, from, unsubscribe, onAuthStateChange, getAuthCallback: () => authCallback }
})

vi.mock('@/lib/supabase', () => ({
    supabase: { from, auth: { onAuthStateChange } },
}))

import { useAdminAuth } from '@/admin/hooks/useAdminAuth'

const sessionFor = (userId: string): Session => ({ user: { id: userId } }) as unknown as Session

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useAdminAuth', () => {
    it('подписывается на onAuthStateChange, не дёргая getSession отдельно', () => {
        renderHook(() => useAdminAuth())
        expect(onAuthStateChange).toHaveBeenCalledTimes(1)
    })

    it('INITIAL_SESSION админа → один запрос map_admin_users и статус ready', async () => {
        maybeSingle.mockResolvedValue({ data: { user_id: 'u1' }, error: null })
        const { result } = renderHook(() => useAdminAuth())

        act(() => {
            getAuthCallback()?.('INITIAL_SESSION', sessionFor('u1'))
        })

        await waitFor(() => {
            expect(result.current.status).toBe('ready')
        })
        expect(from).toHaveBeenCalledTimes(1)
        expect(from).toHaveBeenCalledWith('map_admin_users')
    })

    it('повторное событие того же пользователя не перезапрашивает map_admin_users', async () => {
        maybeSingle.mockResolvedValue({ data: { user_id: 'u1' }, error: null })
        const { result } = renderHook(() => useAdminAuth())

        act(() => {
            getAuthCallback()?.('INITIAL_SESSION', sessionFor('u1'))
        })
        await waitFor(() => {
            expect(result.current.status).toBe('ready')
        })

        // TOKEN_REFRESHED по тому же пользователю — новый запрос не нужен.
        act(() => {
            getAuthCallback()?.('TOKEN_REFRESHED', sessionFor('u1'))
        })

        expect(from).toHaveBeenCalledTimes(1)
    })

    it('не-админ → forbidden', async () => {
        maybeSingle.mockResolvedValue({ data: null, error: null })
        const { result } = renderHook(() => useAdminAuth())

        act(() => {
            getAuthCallback()?.('INITIAL_SESSION', sessionFor('u2'))
        })

        await waitFor(() => {
            expect(result.current.status).toBe('forbidden')
        })
    })

    it('нет сессии → unauthenticated, без запроса', async () => {
        const { result } = renderHook(() => useAdminAuth())

        act(() => {
            getAuthCallback()?.('INITIAL_SESSION', null)
        })

        await waitFor(() => {
            expect(result.current.status).toBe('unauthenticated')
        })
        expect(from).not.toHaveBeenCalled()
    })

    it('смена пользователя перезапрашивает проверку', async () => {
        maybeSingle.mockResolvedValue({ data: { user_id: 'u1' }, error: null })
        const { result } = renderHook(() => useAdminAuth())

        act(() => {
            getAuthCallback()?.('INITIAL_SESSION', sessionFor('u1'))
        })
        await waitFor(() => {
            expect(result.current.status).toBe('ready')
        })

        act(() => {
            getAuthCallback()?.('SIGNED_IN', sessionFor('u2'))
        })

        expect(from).toHaveBeenCalledTimes(2)
    })

    it('отписывается при размонтировании', () => {
        const { unmount } = renderHook(() => useAdminAuth())
        unmount()
        expect(unsubscribe).toHaveBeenCalledTimes(1)
    })
})
