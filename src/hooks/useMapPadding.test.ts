import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Map as MapboxMap } from 'mapbox-gl'
import { computeMapPadding, useMapPadding } from './useMapPadding'

function makeMap(padding = { top: 0, right: 0, bottom: 0, left: 0 }) {
    return {
        getPadding: vi.fn(() => padding),
        setPadding: vi.fn(),
        easeTo: vi.fn(),
    } as unknown as MapboxMap & { setPadding: ReturnType<typeof vi.fn>; easeTo: ReturnType<typeof vi.fn> }
}

describe('computeMapPadding', () => {
    it('desktop: список слева (left=360), карточка справа (right=320)', () => {
        expect(computeMapPadding(true, true, true)).toEqual({ top: 0, right: 320, bottom: 0, left: 360 })
    })

    it('mobile: карточка снизу 45vh имеет приоритет над списком 80vh', () => {
        const original = window.innerHeight
        Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
        expect(computeMapPadding(false, true, true)).toEqual({ top: 0, right: 0, bottom: 450, left: 0 })
        expect(computeMapPadding(false, false, true)).toEqual({ top: 0, right: 0, bottom: 800, left: 0 })
        Object.defineProperty(window, 'innerHeight', { value: original, configurable: true })
    })
})

describe('useMapPadding', () => {
    it('выставляет padding мгновенно через setPadding, без анимации easeTo', () => {
        const map = makeMap()
        renderHook(() => {
            useMapPadding({ map, isDesktop: true, hasFeatureSidebar: false, hasListSidebar: true })
        })
        expect(map.setPadding).toHaveBeenCalledWith({ top: 0, right: 0, bottom: 0, left: 360 })
        expect(map.easeTo).not.toHaveBeenCalled()
    })

    it('не трогает padding, если он уже совпадает с целевым', () => {
        const map = makeMap({ top: 0, right: 0, bottom: 0, left: 360 })
        renderHook(() => {
            useMapPadding({ map, isDesktop: true, hasFeatureSidebar: false, hasListSidebar: true })
        })
        expect(map.setPadding).not.toHaveBeenCalled()
    })
})
