import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AdminLoginPage } from '@/admin/pages/AdminLoginPage'
import { isPasskeySupported, signInWithPasskey } from '@/admin/lib/passkeys'
import { requireSupabase } from '@/lib/supabase'
import { signInWithTelegram } from '@/admin/lib/telegramIdentity'
import { sendPasswordReset } from '@/admin/lib/passwordReset'

vi.mock('@/admin/lib/passkeys', () => ({
    isPasskeySupported: vi.fn(),
    signInWithPasskey: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
    requireSupabase: vi.fn(),
}))

vi.mock('@/admin/lib/telegramIdentity', () => ({
    signInWithTelegram: vi.fn(),
}))

vi.mock('@/admin/lib/passwordReset', () => ({
    sendPasswordReset: vi.fn(),
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
    vi.mocked(signInWithTelegram).mockResolvedValue(undefined)
    vi.mocked(sendPasswordReset).mockResolvedValue(undefined)
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

    it('запускает вход через Telegram', async () => {
        setup()

        fireEvent.click(screen.getByRole('button', { name: 'Войти через Telegram' }))

        await waitFor(() => {
            expect(signInWithTelegram).toHaveBeenCalled()
        })
    })

    it('показывает ошибку входа через Telegram', async () => {
        vi.mocked(signInWithTelegram).mockRejectedValue(new Error('Provider telegram could not be found'))
        setup()

        fireEvent.click(screen.getByRole('button', { name: 'Войти через Telegram' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Provider telegram could not be found')
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

    it('отправляет ссылку восстановления на введённый email', async () => {
        setup()
        fireEvent.click(screen.getByRole('button', { name: 'Войти по email и паролю' }))
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Забыли пароль?' }))

        await waitFor(() => {
            expect(sendPasswordReset).toHaveBeenCalledWith('admin@example.com')
        })
        expect(await screen.findByText(/Письмо со ссылкой отправлено/)).toBeInTheDocument()
    })

    it('без корректного email письмо не отправляет', () => {
        setup()
        fireEvent.click(screen.getByRole('button', { name: 'Войти по email и паролю' }))
        fireEvent.click(screen.getByRole('button', { name: 'Забыли пароль?' }))

        expect(sendPasswordReset).not.toHaveBeenCalled()
        expect(screen.getByText('Введите корректный email')).toBeInTheDocument()
    })
})
