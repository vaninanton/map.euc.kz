import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('@/lib/supabase', () => ({
    requireSupabase: () => ({ rpc }),
}))

import { getDashboardStats } from '@/admin/lib/adminApi/dashboard'

const STATS = {
    points: { total: 1, sockets: 0, meetings: 0, disabled: 0 },
    routes: { total: 0, disabled: 0 },
    photos_total: 0,
    events: { total: 0, disabled: 0 },
    upcoming_event_dates: 0,
    next_event_starts_at: null,
    participants_total: 0,
    news_total: 0,
    submissions_pending: 0,
    chats_enabled: 0,
    outbound_errors_30d: 0,
    last_location_at: null,
    riders: { today: 0, week: 0, month: 0, year: 0 },
    daily_activity: [],
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('getDashboardStats', () => {
    it('вызывает RPC get_admin_dashboard_stats и парсит ответ', async () => {
        rpc.mockResolvedValue({ data: STATS, error: null })
        const stats = await getDashboardStats()
        expect(rpc).toHaveBeenCalledWith('get_admin_dashboard_stats')
        expect(stats.points.total).toBe(1)
        expect(stats.daily_activity).toEqual([])
    })

    it('ошибка PostgREST пробрасывается с сообщением', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'Доступ только для администраторов' } })
        await expect(getDashboardStats()).rejects.toThrow('Доступ только для администраторов')
    })

    it('битая форма ответа — понятная ошибка', async () => {
        rpc.mockResolvedValue({ data: { riders: {} }, error: null })
        await expect(getDashboardStats()).rejects.toThrow('getDashboardStats')
    })
})
