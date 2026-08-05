import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AdminLoginPage } from '@/admin/pages/AdminLoginPage'
import { isPasskeySupported, signInWithPasskey } from '@/admin/lib/passkeys'
import { requireSupabase } from '@/lib/supabase'

vi.mock('@/admin/lib/passkeys', () => ({
    isPasskeySupported: vi.fn(),
    signInWithPasskey: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
    requireSupabase: vi.fn(),
}))

const signInWithPassword = vi.fn()

function setup() {
    return render(
        <MemoryRouter>
            <AdminLoginPage />
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isPasskeySupported).mockReturnValue(true)
    // Моку клиента не нужен полный тип SupabaseClient — страница вызывает только signInWithPassword.
    vi.mocked(requireSupabase).mockReturnValue({
        auth: { signInWithPassword },
    } as unknown as ReturnType<typeof requireSupabase>)
})

describe('AdminLoginPage', () => {
    it('пасскей — способ по умолчанию, форма пароля скрыта', () => {
        setup()
        expect(screen.getByRole('button', { name: 'Войти по пасскею' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Пароль')).not.toBeInTheDocument()
    })

    it('кнопки входа через Telegram нет', () => {
        setup()
        expect(screen.queryByText(/Telegram/)).not.toBeInTheDocument()
    })

    it('вызывает вход по пасскею', async () => {
        vi.mocked(signInWithPasskey).mockResolvedValue(undefined)
        setup()

        fireEvent.click(screen.getByRole('button', { name: 'Войти по пасскею' }))

        await waitFor(() => {
            expect(signInWithPasskey).toHaveBeenCalled()
        })
    })

    it('показывает ошибку пасскея', async () => {
        vi.mocked(signInWithPasskey).mockRejectedValue(new Error('Операция с пасскеем отменена.'))
        setup()

        fireEvent.click(screen.getByRole('button', { name: 'Войти по пасскею' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Операция с пасскеем отменена.')
    })

    it('без поддержки WebAuthn показывает подсказку вместо кнопки пасскея', () => {
        vi.mocked(isPasskeySupported).mockReturnValue(false)
        setup()
        expect(screen.queryByRole('button', { name: 'Войти по пасскею' })).not.toBeInTheDocument()
        expect(screen.getByText(/не поддерживает пасскеи/)).toBeInTheDocument()
    })

    it('разворачивает резервную форму email+пароль и логинит', async () => {
        signInWithPassword.mockResolvedValue({ error: null })
        setup()

        fireEvent.click(screen.getByRole('button', { name: 'Войти по email и паролю' }))
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } })
        fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret123' } })
        fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

        await waitFor(() => {
            expect(signInWithPassword).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'secret123' })
        })
    })
})
