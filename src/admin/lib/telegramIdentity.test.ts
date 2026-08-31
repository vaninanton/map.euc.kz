import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    TELEGRAM_PROVIDER,
    describeTelegramIdentity,
    fetchTelegramIdentity,
    linkTelegram,
    signInWithTelegram,
    unlinkTelegram,
} from '@/admin/lib/telegramIdentity'
import { requireSupabase } from '@/lib/supabase'
import type { UserIdentity } from '@supabase/supabase-js'

vi.mock('@/lib/supabase', () => ({
    requireSupabase: vi.fn(),
}))

const signInWithOAuth = vi.fn()
const linkIdentity = vi.fn()
const unlinkIdentity = vi.fn()
const getUserIdentities = vi.fn()

function identity(overrides: Partial<UserIdentity> = {}): UserIdentity {
    return {
        id: 'i1',
        user_id: 'u1',
        identity_id: 'ii1',
        provider: TELEGRAM_PROVIDER,
        identity_data: { user_name: 'vanton' },
        created_at: '2026-09-01T00:00:00Z',
        last_sign_in_at: null,
        updated_at: null,
        ...overrides,
    } as UserIdentity
}

beforeEach(() => {
    vi.clearAllMocks()
    signInWithOAuth.mockResolvedValue({ error: null })
    linkIdentity.mockResolvedValue({ error: null })
    unlinkIdentity.mockResolvedValue({ error: null })
    vi.mocked(requireSupabase).mockReturnValue({
        auth: { signInWithOAuth, linkIdentity, unlinkIdentity, getUserIdentities },
    } as unknown as ReturnType<typeof requireSupabase>)
})

describe('telegramIdentity', () => {
    // Главная ловушка: встроенного провайдера `telegram` в GoTrue нет, на голое имя приходит 400.
    it('провайдер — custom:telegram', () => {
        expect(TELEGRAM_PROVIDER).toBe('custom:telegram')
    })

    it('вход идёт в custom:telegram с возвратом на /admin', async () => {
        await signInWithTelegram()
        expect(signInWithOAuth).toHaveBeenCalledWith({
            provider: 'custom:telegram',
            options: { redirectTo: `${window.location.origin}/admin` },
        })
    })

    it('привязка идёт в тот же провайдер', async () => {
        await linkTelegram()
        expect(linkIdentity).toHaveBeenCalledWith({
            provider: 'custom:telegram',
            options: { redirectTo: `${window.location.origin}/admin` },
        })
    })

    it('пробрасывает ошибку входа', async () => {
        signInWithOAuth.mockResolvedValue({ error: new Error('Provider telegram could not be found') })
        await expect(signInWithTelegram()).rejects.toThrow('Provider telegram could not be found')
    })

    it('находит telegram-identity среди прочих', async () => {
        const telegram = identity()
        getUserIdentities.mockResolvedValue({
            data: { identities: [identity({ id: 'i0', provider: 'email' }), telegram] },
            error: null,
        })
        await expect(fetchTelegramIdentity()).resolves.toBe(telegram)
    })

    it('без привязки возвращает null', async () => {
        getUserIdentities.mockResolvedValue({ data: { identities: [identity({ provider: 'email' })] }, error: null })
        await expect(fetchTelegramIdentity()).resolves.toBeNull()
    })

    it('отвязывает переданную identity', async () => {
        const telegram = identity()
        await unlinkTelegram(telegram)
        expect(unlinkIdentity).toHaveBeenCalledWith(telegram)
    })

    it('подписывает аккаунт по username, имени, телефону или id', () => {
        expect(describeTelegramIdentity(identity())).toBe('@vanton')
        // Claim'ы Telegram как есть, без переименования в attribute mapping провайдера.
        expect(describeTelegramIdentity(identity({ identity_data: { preferred_username: 'vanton' } }))).toBe('@vanton')
        expect(describeTelegramIdentity(identity({ identity_data: { name: 'Тони' } }))).toBe('Тони')
        expect(describeTelegramIdentity(identity({ identity_data: { full_name: 'Тони' } }))).toBe('Тони')
        expect(describeTelegramIdentity(identity({ identity_data: { phone_number: '+7700…' } }))).toBe('+7700…')
        expect(describeTelegramIdentity(identity({ identity_data: {} }))).toBe('id i1')
    })
})
