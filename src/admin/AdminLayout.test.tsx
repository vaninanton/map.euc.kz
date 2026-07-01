import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AdminLayout } from '@/admin/AdminLayout'
import { countPendingSubmissions } from '@/admin/lib/adminApi'

vi.mock('@/admin/lib/adminApi', () => ({
    countPendingSubmissions: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
    supabase: null,
}))

function setup() {
    return render(
        <MemoryRouter initialEntries={['/admin']}>
            <AdminLayout />
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('AdminLayout', () => {
    it('рендерит пункты меню, включая Дашборд', async () => {
        vi.mocked(countPendingSubmissions).mockResolvedValue(0)
        setup()
        expect(screen.getByText('Дашборд')).toBeInTheDocument()
        expect(screen.getByText('Заявки')).toBeInTheDocument()
        await waitFor(() => {
            expect(countPendingSubmissions).toHaveBeenCalled()
        })
    })

    it('показывает бейдж с числом pending-заявок', async () => {
        vi.mocked(countPendingSubmissions).mockResolvedValue(4)
        setup()
        expect(await screen.findByLabelText('Заявок на модерации: 4')).toHaveTextContent('4')
    })

    it('при нуле заявок бейджа нет', async () => {
        vi.mocked(countPendingSubmissions).mockResolvedValue(0)
        setup()
        await waitFor(() => {
            expect(countPendingSubmissions).toHaveBeenCalled()
        })
        expect(screen.queryByLabelText(/Заявок на модерации/)).not.toBeInTheDocument()
    })

    it('ошибка запроса не ломает меню', async () => {
        vi.mocked(countPendingSubmissions).mockRejectedValue(new Error('network'))
        setup()
        await waitFor(() => {
            expect(countPendingSubmissions).toHaveBeenCalled()
        })
        expect(screen.getByText('Заявки')).toBeInTheDocument()
        expect(screen.queryByLabelText(/Заявок на модерации/)).not.toBeInTheDocument()
    })
})
