import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    deletePasskey,
    isPasskeySupported,
    listPasskeys,
    passkeyErrorMessage,
    registerPasskey,
    renamePasskey,
    signInWithPasskey,
} from '@/admin/lib/passkeys'
import { requireSupabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
    requireSupabase: vi.fn(),
}))

const auth = {
    signInWithPasskey: vi.fn(),
    registerPasskey: vi.fn(),
    passkey: {
        list: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // Моку клиента не нужен полный тип SupabaseClient — используем только auth-методы пасскея.
    vi.mocked(requireSupabase).mockReturnValue({ auth } as unknown as ReturnType<typeof requireSupabase>)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('isPasskeySupported', () => {
    it('false, если в браузере нет PublicKeyCredential', () => {
        expect(isPasskeySupported()).toBe(false)
    })

    it('true, если есть PublicKeyCredential и credentials API', () => {
        vi.stubGlobal('PublicKeyCredential', function PublicKeyCredentialStub() {
            /* stub */
        })
        vi.stubGlobal('navigator', { credentials: { create: () => undefined, get: () => undefined } })
        expect(isPasskeySupported()).toBe(true)
        vi.unstubAllGlobals()
    })
})

describe('passkeyErrorMessage', () => {
    it('переводит известный код WebAuthnError', () => {
        expect(passkeyErrorMessage({ code: 'ERROR_CEREMONY_ABORTED', message: 'aborted' })).toBe(
            'Операция с пасскеем отменена.',
        )
    })

    it('для неизвестного кода отдаёт сообщение ошибки', () => {
        expect(passkeyErrorMessage(new Error('boom'))).toBe('boom')
    })
})

describe('signInWithPasskey', () => {
    it('не бросает при успехе', async () => {
        auth.signInWithPasskey.mockResolvedValue({ data: { session: {}, user: {} }, error: null })
        await expect(signInWithPasskey()).resolves.toBeUndefined()
    })

    it('бросает переведённую ошибку отмены', async () => {
        auth.signInWithPasskey.mockResolvedValue({
            data: null,
            error: { code: 'ERROR_CEREMONY_ABORTED', message: 'aborted' },
        })
        await expect(signInWithPasskey()).rejects.toThrow('Операция с пасскеем отменена.')
    })
})

describe('listPasskeys', () => {
    it('нормализует необязательные поля в null', async () => {
        auth.passkey.list.mockResolvedValue({
            data: [{ id: 'p1', created_at: '2026-01-01T00:00:00Z' }],
            error: null,
        })
        await expect(listPasskeys()).resolves.toEqual([
            { id: 'p1', friendly_name: null, created_at: '2026-01-01T00:00:00Z', last_used_at: null },
        ])
    })

    it('бросает ошибку SDK', async () => {
        auth.passkey.list.mockResolvedValue({ data: null, error: new Error('нет сессии') })
        await expect(listPasskeys()).rejects.toThrow('нет сессии')
    })
})

describe('registerPasskey', () => {
    it('переименовывает пасскей вторым запросом, если имя задано', async () => {
        auth.registerPasskey.mockResolvedValue({
            data: { id: 'p1', created_at: '2026-01-01T00:00:00Z' },
            error: null,
        })
        auth.passkey.update.mockResolvedValue({
            data: { id: 'p1', friendly_name: 'iPhone', created_at: '2026-01-01T00:00:00Z' },
            error: null,
        })

        const created = await registerPasskey('  iPhone  ')

        expect(auth.passkey.update).toHaveBeenCalledWith({ passkeyId: 'p1', friendlyName: 'iPhone' })
        expect(created.friendly_name).toBe('iPhone')
    })

    it('не переименовывает при пустом имени', async () => {
        auth.registerPasskey.mockResolvedValue({
            data: { id: 'p1', created_at: '2026-01-01T00:00:00Z' },
            error: null,
        })

        await registerPasskey('   ')

        expect(auth.passkey.update).not.toHaveBeenCalled()
    })

    it('бросает ошибку регистрации', async () => {
        auth.registerPasskey.mockResolvedValue({ data: null, error: new Error('отказ устройства') })
        await expect(registerPasskey('iPhone')).rejects.toThrow('отказ устройства')
    })
})

describe('renamePasskey / deletePasskey', () => {
    it('renamePasskey возвращает обновлённую запись', async () => {
        auth.passkey.update.mockResolvedValue({
            data: { id: 'p1', friendly_name: 'Mac', created_at: '2026-01-01T00:00:00Z', last_used_at: 'x' },
            error: null,
        })
        await expect(renamePasskey('p1', 'Mac')).resolves.toEqual({
            id: 'p1',
            friendly_name: 'Mac',
            created_at: '2026-01-01T00:00:00Z',
            last_used_at: 'x',
        })
    })

    it('deletePasskey бросает ошибку SDK', async () => {
        auth.passkey.delete.mockResolvedValue({ error: new Error('не найден') })
        await expect(deletePasskey('p1')).rejects.toThrow('не найден')
    })
})
