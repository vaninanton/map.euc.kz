import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DashboardPage } from '@/admin/pages/DashboardPage'
import { getDashboardStats, listRoutes, type AdminDashboardStats } from '@/admin/lib/adminApi'

vi.mock('@/admin/lib/adminApi', () => ({
    getDashboardStats: vi.fn(),
    listRoutes: vi.fn(),
}))

const STATS: AdminDashboardStats = {
    points: { total: 42, sockets: 10, meetings: 5, disabled: 2 },
    routes: { total: 2, disabled: 0 },
    photos_total: 30,
    events: { total: 3, disabled: 0 },
    upcoming_event_dates: 2,
    next_event_starts_at: '2026-07-05T14:00:00+00:00',
    participants_total: 12,
    news_total: 4,
    submissions_pending: 0,
    chats_enabled: 3,
    outbound_errors_30d: 0,
    last_location_at: new Date().toISOString(),
    riders: { today: 5, week: 11, month: 20, year: 60 },
    daily_activity: [
        { day: '2026-07-01', riders: 3, locations: 120 },
        { day: '2026-07-02', riders: 5, locations: 200 },
    ],
}

// два одинаковых сегмента ~0.9 км каждый
const ROUTES = [
    { coordinates: [[76.9, 43.2] as [number, number], [76.91, 43.2] as [number, number]] },
    { coordinates: [[76.9, 43.2] as [number, number], [76.91, 43.2] as [number, number]] },
]

function setup(stats: AdminDashboardStats = STATS) {
    vi.mocked(getDashboardStats).mockResolvedValue(stats)
    vi.mocked(listRoutes).mockResolvedValue(ROUTES as never)
    return render(
        <MemoryRouter>
            <DashboardPage />
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('DashboardPage', () => {
    it('показывает счётчики райдеров за периоды', async () => {
        setup()
        expect(await screen.findByText('Сегодня')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument()
        expect(screen.getByText('11')).toBeInTheDocument()
        expect(screen.getByText('60')).toBeInTheDocument()
    })

    it('показывает контент: точки и суммарный километраж маршрутов', async () => {
        setup()
        expect(await screen.findByText('42')).toBeInTheDocument()
        expect(screen.getByText(/розеток: 10/)).toBeInTheDocument()
        expect(screen.getByText(/1\.6 км суммарно/)).toBeInTheDocument()
    })

    it('без pending-заявок и ошибок алертов нет', async () => {
        setup()
        await screen.findByText('Дашборд')
        expect(screen.queryByText(/Заявок на модерации/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Ошибок отправки/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Проверьте webhook/)).not.toBeInTheDocument()
    })

    it('показывает алерты: pending-заявки, ошибки рассылки, мёртвый webhook', async () => {
        setup({
            ...STATS,
            submissions_pending: 3,
            outbound_errors_30d: 2,
            last_location_at: '2026-01-01T00:00:00+00:00',
        })
        expect(await screen.findByText(/Заявок на модерации: 3/)).toBeInTheDocument()
        expect(screen.getByText(/Ошибок отправки в Telegram за 30 дней: 2/)).toBeInTheDocument()
        expect(screen.getByText(/Проверьте webhook/)).toBeInTheDocument()
    })

    it('рисует sparkline активности', async () => {
        setup()
        expect(await screen.findByRole('img', { name: /Активность райдеров/ })).toBeInTheDocument()
    })

    it('ошибка RPC — сообщение об ошибке', async () => {
        vi.mocked(getDashboardStats).mockRejectedValue(new Error('forbidden'))
        vi.mocked(listRoutes).mockResolvedValue([])
        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>,
        )
        expect(await screen.findByText(/Не удалось загрузить статистику: forbidden/)).toBeInTheDocument()
    })

    it('ошибка списка маршрутов не роняет дашборд — км просто не показываются', async () => {
        vi.mocked(getDashboardStats).mockResolvedValue(STATS)
        vi.mocked(listRoutes).mockRejectedValue(new Error('network'))
        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>,
        )
        expect(await screen.findByText('Дашборд')).toBeInTheDocument()
        expect(screen.queryByText(/км суммарно/)).not.toBeInTheDocument()
    })
})
