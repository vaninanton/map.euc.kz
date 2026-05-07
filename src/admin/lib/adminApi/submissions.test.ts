import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminMapPoint, MapPointInput } from '@/admin/lib/adminApi/types'

const createPoint = vi.fn()
const single = vi.fn()
const select = vi.fn(() => ({ eq: vi.fn(() => ({ single })) }))
const updateEqStatus = vi.fn()
const updateEqId = vi.fn(() => ({ eq: updateEqStatus }))
const update = vi.fn(() => ({ eq: updateEqId }))
const fromTable = vi.fn((table: string) => {
    if (table !== 'map_points_submissions') throw new Error(`Unexpected table: ${table}`)
    return { select, update }
})

vi.mock('@/admin/lib/adminApi/points', () => ({ createPoint }))
vi.mock('@/lib/supabase', () => ({
    requireSupabase: () => ({ from: fromTable }),
}))

function submission(status: 'pending' | 'approved' | 'rejected' = 'pending') {
    return {
        id: 'sub-1',
        created_at: '2026-01-01T00:00:00Z',
        processed_at: null,
        type: 'socket',
        title: 'Public charger',
        description: null,
        coordinates: ['76.95', '43.24'],
        flag_is_meeting: true,
        status,
    }
}

describe('adminApi submissions', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-07T10:15:30Z'))
        single.mockResolvedValue({ data: submission(), error: null })
        updateEqStatus.mockResolvedValue({ error: null })
        createPoint.mockResolvedValue({
            id: 10,
            created_at: '2026-05-07T10:15:30Z',
            type: 'socket',
            title: 'Public charger',
            description: null,
            coordinates: [76.95, 43.24],
            flag_is_meeting: false,
            flag_has_socket: true,
            flag_disabled: false,
        } satisfies AdminMapPoint)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('approveSubmission creates a visible map point and marks the submission approved', async () => {
        const { approveSubmission } = await import('@/admin/lib/adminApi/submissions')

        await expect(approveSubmission('sub-1')).resolves.toMatchObject({ id: 10 })

        expect(createPoint).toHaveBeenCalledWith({
            type: 'socket',
            title: 'Public charger',
            description: null,
            coordinates: [76.95, 43.24],
            flag_is_meeting: false,
            flag_has_socket: true,
            flag_disabled: false,
        } satisfies MapPointInput)
        expect(update).toHaveBeenCalledWith({
            status: 'approved',
            processed_at: '2026-05-07T10:15:30.000Z',
        })
        expect(updateEqId).toHaveBeenCalledWith('id', 'sub-1')
    })

    it('approveSubmission is guarded against already processed submissions', async () => {
        const { approveSubmission } = await import('@/admin/lib/adminApi/submissions')
        single.mockResolvedValueOnce({ data: submission('approved'), error: null })

        await expect(approveSubmission('sub-1')).rejects.toThrow('Заявка уже обработана.')

        expect(createPoint).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()
    })

    it('rejectSubmission updates only pending rows to avoid overwriting processed submissions', async () => {
        const { rejectSubmission } = await import('@/admin/lib/adminApi/submissions')

        await expect(rejectSubmission('sub-1')).resolves.toBeUndefined()

        expect(update).toHaveBeenCalledWith({
            status: 'rejected',
            processed_at: '2026-05-07T10:15:30.000Z',
        })
        expect(updateEqId).toHaveBeenCalledWith('id', 'sub-1')
        expect(updateEqStatus).toHaveBeenCalledWith('status', 'pending')
    })
})
