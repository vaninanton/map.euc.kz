import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RESET_PASSWORD_PATH, sendPasswordReset, updatePassword } from '@/admin/lib/passwordReset'
import { requireSupabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
    requireSupabase: vi.fn(),
}))

const resetPasswordForEmail = vi.fn()
const updateUser = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    resetPasswordForEmail.mockResolvedValue({ error: null })
    updateUser.mockResolvedValue({ error: null })
    vi.mocked(requireSupabase).mockReturnValue({
        auth: { resetPasswordForEmail, updateUser },
    } as unknown as ReturnType<typeof requireSupabase>)
})

describe('passwordReset', () => {
    it('возвращает по ссылке на форму нового пароля, а не просто в админку', async () => {
        await sendPasswordReset('  admin@example.com  ')
        expect(resetPasswordForEmail).toHaveBeenCalledWith('admin@example.com', {
            redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
        })
    })

    it('пробрасывает ошибку отправки', async () => {
        resetPasswordForEmail.mockResolvedValue({ error: new Error('Email rate limit exceeded') })
        await expect(sendPasswordReset('admin@example.com')).rejects.toThrow('Email rate limit exceeded')
    })

    it('сохраняет пароль через updateUser', async () => {
        await updatePassword('secret123')
        expect(updateUser).toHaveBeenCalledWith({ password: 'secret123' })
    })

    it('пробрасывает ошибку сохранения', async () => {
        updateUser.mockResolvedValue({ error: new Error('Password is too weak') })
        await expect(updatePassword('123')).rejects.toThrow('Password is too weak')
    })
})
