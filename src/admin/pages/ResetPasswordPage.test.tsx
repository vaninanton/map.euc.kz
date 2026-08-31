import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ResetPasswordPage } from '@/admin/pages/ResetPasswordPage'
import { updatePassword } from '@/admin/lib/passwordReset'

vi.mock('@/admin/lib/passwordReset', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/admin/lib/passwordReset')>()),
    updatePassword: vi.fn(),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}))

function setup() {
    return render(
        <MemoryRouter>
            <ResetPasswordPage />
        </MemoryRouter>,
    )
}

function fill(password: string, repeat: string) {
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } })
    fireEvent.change(screen.getByLabelText('Ещё раз'), { target: { value: repeat } })
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updatePassword).mockResolvedValue(undefined)
})

describe('ResetPasswordPage', () => {
    it('сохраняет новый пароль и сообщает об успехе', async () => {
        setup()
        fill('secret123', 'secret123')
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }))

        await waitFor(() => {
            expect(updatePassword).toHaveBeenCalledWith('secret123')
        })
        expect(await screen.findByText(/Пароль обновлён/)).toBeInTheDocument()
    })

    it('не отправляет короткий пароль', () => {
        setup()
        fill('123', '123')
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }))

        expect(updatePassword).not.toHaveBeenCalled()
        expect(screen.getByText(/Минимум 6 символов/)).toBeInTheDocument()
    })

    it('не отправляет при несовпадении паролей', () => {
        setup()
        fill('secret123', 'secret124')
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }))

        expect(updatePassword).not.toHaveBeenCalled()
        expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument()
    })

    it('показывает ошибку Supabase', async () => {
        vi.mocked(updatePassword).mockRejectedValue(new Error('New password should be different from the old password'))
        setup()
        fill('secret123', 'secret123')
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('should be different')
    })
})
