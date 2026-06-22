import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { dateAt, eventDate, makeEvent as makeBaseEvent } from '@/test/eventFactories'
import type { EventRow } from '@/types'

// supabase != null, чтобы хук считал бэкенд настроенным и грузил данные.
vi.mock('@/lib/supabase', () => ({
    supabase: {},
    fetchEvents: vi.fn(),
}))

import { useEvents } from './useEvents'
import { fetchEvents } from '@/lib/supabase'

const mockFetch = vi.mocked(fetchEvents)

/** Актуальное событие: создано час назад, с одной будущей датой (есть getNextOccurrence). */
function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
    return makeBaseEvent({
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        dates: [eventDate({ starts_at: dateAt(3) })],
        ...overrides,
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
})

describe('useEvents', () => {
    it('загружает события и снимает loading', async () => {
        const events = [makeEvent()]
        mockFetch.mockResolvedValue(events)

        const { result } = renderHook(() => useEvents())
        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })
        expect(result.current.events).toEqual(events)
        expect(result.current.error).toBeNull()
    })

    it('кладёт сообщение ошибки в error и не падает', async () => {
        mockFetch.mockRejectedValue(new Error('сеть упала'))

        const { result } = renderHook(() => useEvents())

        await waitFor(() => {
            expect(result.current.error).toBe('сеть упала')
        })
        expect(result.current.loading).toBe(false)
        expect(result.current.events).toEqual([])
    })

    it('даёт дефолтный текст ошибки для не-Error', async () => {
        mockFetch.mockRejectedValue('строка')

        const { result } = renderHook(() => useEvents())

        await waitFor(() => {
            expect(result.current.error).toBe('Не удалось загрузить события')
        })
    })

    it('считает все актуальные события непрочитанными, пока ленту не открывали', async () => {
        mockFetch.mockResolvedValue([makeEvent({ id: 'a' }), makeEvent({ id: 'b' })])

        const { result } = renderHook(() => useEvents())

        await waitFor(() => {
            expect(result.current.unreadCount).toBe(2)
        })
    })

    it('markAsRead обнуляет счётчик непрочитанных и сохраняет дату', async () => {
        mockFetch.mockResolvedValue([makeEvent()])

        const { result } = renderHook(() => useEvents())
        await waitFor(() => {
            expect(result.current.unreadCount).toBe(1)
        })

        act(() => {
            result.current.markAsRead()
        })

        expect(result.current.unreadCount).toBe(0)
        expect(localStorage.getItem('map-euc-events-last-read')).toBeTruthy()
    })

    it('не считает прошедшие события непрочитанными', async () => {
        mockFetch.mockResolvedValue([makeEvent({ id: 'past', dates: [eventDate({ starts_at: dateAt(-3) })] })])

        const { result } = renderHook(() => useEvents())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })
        expect(result.current.unreadCount).toBe(0)
    })

    it('reload повторно вызывает fetchEvents', async () => {
        mockFetch.mockResolvedValue([makeEvent()])

        const { result } = renderHook(() => useEvents())
        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })
        expect(mockFetch).toHaveBeenCalledTimes(1)

        act(() => {
            result.current.reload()
        })

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })
    })
})
