import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLayerVisibilityStore } from './useLayerVisibilityStore'

const STORAGE_KEY = 'map-euc-layer-visibility'

beforeEach(() => {
    localStorage.clear()
})

describe('useLayerVisibilityStore', () => {
    it('возвращает дефолтную видимость без сохранённого состояния', () => {
        const { result } = renderHook(() => useLayerVisibilityStore())
        expect(result.current.visibility).toEqual({
            points: true,
            sockets: true,
            routes: true,
            bikeLanes: true,
            telegramUsers: true,
        })
    })

    it('загружает состояние из localStorage', () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ points: false, sockets: true, routes: true, bikeLanes: false, telegramUsers: true }),
        )
        const { result } = renderHook(() => useLayerVisibilityStore())
        expect(result.current.visibility.points).toBe(false)
        expect(result.current.visibility.bikeLanes).toBe(false)
    })

    it('использует дефолт при невалидном JSON в localStorage', () => {
        localStorage.setItem(STORAGE_KEY, 'not-json')
        const { result } = renderHook(() => useLayerVisibilityStore())
        expect(result.current.visibility.points).toBe(true)
    })

    it('toggleLayer инвертирует слой и сохраняет в localStorage', () => {
        const { result } = renderHook(() => useLayerVisibilityStore())
        act(() => { result.current.toggleLayer('routes') })
        expect(result.current.visibility.routes).toBe(false)
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
        expect(stored.routes).toBe(false)
    })

    it('toggleLayer дважды возвращает в исходное состояние', () => {
        const { result } = renderHook(() => useLayerVisibilityStore())
        act(() => { result.current.toggleLayer('points') })
        act(() => { result.current.toggleLayer('points') })
        expect(result.current.visibility.points).toBe(true)
    })

    it('setLayerVisibility устанавливает конкретное значение', () => {
        const { result } = renderHook(() => useLayerVisibilityStore())
        act(() => { result.current.setLayerVisibility('sockets', false) })
        expect(result.current.visibility.sockets).toBe(false)
    })

    it('setLayerVisibility не вызывает лишний ре-рендер если значение не изменилось', () => {
        const { result } = renderHook(() => useLayerVisibilityStore())
        const visibilityBefore = result.current.visibility
        act(() => { result.current.setLayerVisibility('routes', true) })
        expect(result.current.visibility).toBe(visibilityBefore)
    })

    it('частичная запись в localStorage дополняется дефолтами', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ points: false }))
        const { result } = renderHook(() => useLayerVisibilityStore())
        expect(result.current.visibility.points).toBe(false)
        expect(result.current.visibility.sockets).toBe(true)
    })
})
