import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
    createMapPointDraft: vi.fn(),
}))
vi.mock('@/utils/hashNav', () => ({
    clearHash: vi.fn(),
}))

import { useDraftPointFlow } from './useDraftPointFlow'
import { createMapPointDraft } from '@/lib/supabase'
import type { MapPointDraftInput } from '@/types'

const mockCreate = vi.mocked(createMapPointDraft)

const DRAFT_INPUT: MapPointDraftInput = {
    title: 'Тестовая точка',
    type: 'point',
    coordinates: [76.9, 43.2],
    description: null,
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useDraftPointFlow', () => {
    it('начальное состояние: не добавляет, нет координат, нет ошибок', () => {
        const { result } = renderHook(() => useDraftPointFlow())
        expect(result.current.isAddingPoint).toBe(false)
        expect(result.current.draftCoordinates).toBeNull()
        expect(result.current.draftSubmitError).toBeNull()
        expect(result.current.draftSubmitSuccess).toBeNull()
    })

    it('handleToggleAddPoint включает режим добавления', () => {
        const { result } = renderHook(() => useDraftPointFlow())
        act(() => {
            result.current.handleToggleAddPoint()
        })
        expect(result.current.isAddingPoint).toBe(true)
    })

    it('handleToggleAddPoint второй раз выключает режим', () => {
        const { result } = renderHook(() => useDraftPointFlow())
        act(() => {
            result.current.handleToggleAddPoint()
        })
        act(() => {
            result.current.handleToggleAddPoint()
        })
        expect(result.current.isAddingPoint).toBe(false)
    })

    it('handleCancelAddPoint сбрасывает состояние', () => {
        const { result } = renderHook(() => useDraftPointFlow())
        act(() => {
            result.current.handleToggleAddPoint()
        })
        act(() => {
            result.current.setDraftCoordinates([76.9, 43.2])
        })
        act(() => {
            result.current.handleCancelAddPoint()
        })
        expect(result.current.isAddingPoint).toBe(false)
        expect(result.current.draftCoordinates).toBeNull()
    })

    it('handleSubmitDraft успешный кейс: isAddingPoint=false, success msg', async () => {
        mockCreate.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useDraftPointFlow())
        act(() => {
            result.current.handleToggleAddPoint()
        })

        await act(async () => {
            await result.current.handleSubmitDraft(DRAFT_INPUT)
        })

        expect(result.current.isAddingPoint).toBe(false)
        expect(result.current.draftSubmitSuccess).toMatch(/модерацию/)
        expect(result.current.draftSubmitError).toBeNull()
    })

    it('handleSubmitDraft при ошибке: устанавливает draftSubmitError', async () => {
        mockCreate.mockRejectedValueOnce(new Error('Сервер недоступен'))
        const { result } = renderHook(() => useDraftPointFlow())
        act(() => {
            result.current.handleToggleAddPoint()
        })

        await act(async () => {
            await result.current.handleSubmitDraft(DRAFT_INPUT)
        })

        expect(result.current.draftSubmitError).toMatch(/Сервер недоступен/)
        expect(result.current.isAddingPoint).toBe(true)
    })

    it('clearDraftSubmitError очищает ошибку', async () => {
        mockCreate.mockRejectedValueOnce(new Error('err'))
        const { result } = renderHook(() => useDraftPointFlow())
        await act(async () => {
            await result.current.handleSubmitDraft(DRAFT_INPUT)
        })
        act(() => {
            result.current.clearDraftSubmitError()
        })
        expect(result.current.draftSubmitError).toBeNull()
    })

    it('вызывает onStartAdding при переключении', () => {
        const onStartAdding = vi.fn()
        const { result } = renderHook(() => useDraftPointFlow(onStartAdding))
        act(() => {
            result.current.handleToggleAddPoint()
        })
        expect(onStartAdding).toHaveBeenCalledOnce()
    })

    it('вызывает clearMapSelectionUrl при переключении если передан', () => {
        const clearUrl = vi.fn()
        const { result } = renderHook(() => useDraftPointFlow(undefined, clearUrl))
        act(() => {
            result.current.handleToggleAddPoint()
        })
        expect(clearUrl).toHaveBeenCalledOnce()
    })
})
