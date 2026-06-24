import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const copyToClipboard = vi.hoisted(() => vi.fn())
const trackGoal = vi.hoisted(() => vi.fn())

vi.mock('@/utils/shareLinks', () => ({ copyToClipboard }))
vi.mock('@/lib/analytics', () => ({ trackGoal }))

import { useCopyShare } from './useCopyShare'

describe('useCopyShare', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        copyToClipboard.mockReset()
        trackGoal.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('на успешном копировании шлёт цель, показывает подтверждение и вызывает onCopied', async () => {
        copyToClipboard.mockResolvedValue(true)
        const onCopied = vi.fn()
        const { result } = renderHook(() => useCopyShare('https://x/y', 'point', onCopied))

        await act(async () => {
            await result.current.handleShare()
        })

        expect(copyToClipboard).toHaveBeenCalledWith('https://x/y')
        expect(trackGoal).toHaveBeenCalledWith('share_app_link', { featureType: 'point' })
        expect(onCopied).toHaveBeenCalledTimes(1)
        expect(result.current.showCopied).toBe(true)
    })

    it('скрывает подтверждение после таймаута', async () => {
        copyToClipboard.mockResolvedValue(true)
        const { result } = renderHook(() => useCopyShare('https://x/y', 'event'))

        await act(async () => {
            await result.current.handleShare()
        })
        expect(result.current.showCopied).toBe(true)

        act(() => {
            vi.advanceTimersByTime(2500)
        })
        expect(result.current.showCopied).toBe(false)
    })

    it('при неудаче не показывает подтверждение и не шлёт цель', async () => {
        copyToClipboard.mockResolvedValue(false)
        const { result } = renderHook(() => useCopyShare('https://x/y', 'route'))

        await act(async () => {
            await result.current.handleShare()
        })

        expect(trackGoal).not.toHaveBeenCalled()
        expect(result.current.showCopied).toBe(false)
    })
})
