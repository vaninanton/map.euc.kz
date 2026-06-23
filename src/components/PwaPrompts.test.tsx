import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { PwaPrompts } from './PwaPrompts'

const { trackGoalMock, isStandaloneLaunchMock } = vi.hoisted(() => ({
    trackGoalMock: vi.fn(),
    isStandaloneLaunchMock: vi.fn(() => false),
}))
vi.mock('@/lib/analytics', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/analytics')>()
    return { ...actual, trackGoal: trackGoalMock, isStandaloneLaunch: isStandaloneLaunchMock }
})

beforeEach(() => {
    trackGoalMock.mockClear()
    isStandaloneLaunchMock.mockReturnValue(false)
})

describe('PwaPrompts — цель pwa_install', () => {
    it('шлёт pwa_install на событие appinstalled', () => {
        render(<PwaPrompts />)
        window.dispatchEvent(new Event('appinstalled'))
        expect(trackGoalMock).toHaveBeenCalledWith('pwa_install')
    })

    it('снимает слушатель при размонтировании', () => {
        const { unmount } = render(<PwaPrompts />)
        unmount()
        window.dispatchEvent(new Event('appinstalled'))
        expect(trackGoalMock).not.toHaveBeenCalledWith('pwa_install')
    })
})

describe('PwaPrompts — цель pwa_launch_standalone', () => {
    it('шлёт pwa_launch_standalone при запуске из standalone', () => {
        isStandaloneLaunchMock.mockReturnValue(true)
        render(<PwaPrompts />)
        expect(trackGoalMock).toHaveBeenCalledWith('pwa_launch_standalone')
    })

    it('не шлёт при запуске в обычной вкладке', () => {
        isStandaloneLaunchMock.mockReturnValue(false)
        render(<PwaPrompts />)
        expect(trackGoalMock).not.toHaveBeenCalledWith('pwa_launch_standalone')
    })
})
