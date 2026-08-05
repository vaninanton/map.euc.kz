import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SettingsPage } from '@/admin/pages/SettingsPage'
import { deletePasskey, isPasskeySupported, registerPasskey, renamePasskey } from '@/admin/lib/passkeys'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'

vi.mock('@/admin/lib/passkeys', () => ({
    isPasskeySupported: vi.fn(),
    listPasskeys: vi.fn(),
    registerPasskey: vi.fn(),
    renamePasskey: vi.fn(),
    deletePasskey: vi.fn(),
}))

vi.mock('@/admin/hooks/useAdminListLoader', () => ({
    useAdminListLoader: vi.fn(),
}))

const PASSKEY = {
    id: 'p1',
    friendly_name: 'iPhone',
    created_at: '2026-01-01T10:00:00Z',
    last_used_at: null,
}

function setupLoader(items = [PASSKEY]) {
    const reload = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAdminListLoader).mockReturnValue({
        items,
        setItems: vi.fn(),
        loading: false,
        error: null,
        setError: vi.fn(),
        reload,
    })
    return { reload }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isPasskeySupported).mockReturnValue(true)
})

describe('SettingsPage', () => {
    it('рендерит список пасскеев', () => {
        setupLoader()
        render(<SettingsPage />)
        expect(screen.getByText('iPhone')).toBeInTheDocument()
        expect(screen.getByText(/Последний вход: никогда/)).toBeInTheDocument()
    })

    it('показывает пустое состояние', () => {
        setupLoader([])
        render(<SettingsPage />)
        expect(screen.getByText(/Пасскеев пока нет/)).toBeInTheDocument()
    })

    it('добавляет пасскей с введённым названием', async () => {
        const { reload } = setupLoader([])
        vi.mocked(registerPasskey).mockResolvedValue({ ...PASSKEY, friendly_name: 'Ноутбук' })
        render(<SettingsPage />)

        fireEvent.change(screen.getByLabelText('Название устройства'), { target: { value: 'Ноутбук' } })
        fireEvent.click(screen.getByRole('button', { name: 'Добавить пасскей' }))

        await waitFor(() => {
            expect(registerPasskey).toHaveBeenCalledWith('Ноутбук')
            expect(reload).toHaveBeenCalled()
        })
        expect(screen.getByText('Пасскей «Ноутбук» добавлен.')).toBeInTheDocument()
    })

    it('показывает ошибку регистрации', async () => {
        setupLoader([])
        vi.mocked(registerPasskey).mockRejectedValue(new Error('Операция с пасскеем отменена.'))
        render(<SettingsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Добавить пасскей' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Операция с пасскеем отменена.')
    })

    it('переименовывает пасскей', async () => {
        const { reload } = setupLoader()
        vi.spyOn(window, 'prompt').mockReturnValue('  Mac  ')
        vi.mocked(renamePasskey).mockResolvedValue({ ...PASSKEY, friendly_name: 'Mac' })
        render(<SettingsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Переименовать' }))

        await waitFor(() => {
            expect(renamePasskey).toHaveBeenCalledWith('p1', 'Mac')
            expect(reload).toHaveBeenCalled()
        })
    })

    it('не переименовывает при отмене prompt', () => {
        setupLoader()
        vi.spyOn(window, 'prompt').mockReturnValue(null)
        render(<SettingsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Переименовать' }))

        expect(renamePasskey).not.toHaveBeenCalled()
    })

    it('удаляет пасскей после подтверждения', async () => {
        const { reload } = setupLoader()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        vi.mocked(deletePasskey).mockResolvedValue(undefined)
        render(<SettingsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

        await waitFor(() => {
            expect(deletePasskey).toHaveBeenCalledWith('p1')
            expect(reload).toHaveBeenCalled()
        })
    })

    it('не удаляет без подтверждения', () => {
        setupLoader()
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        render(<SettingsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

        expect(deletePasskey).not.toHaveBeenCalled()
    })

    it('без поддержки WebAuthn скрывает форму добавления', () => {
        setupLoader()
        vi.mocked(isPasskeySupported).mockReturnValue(false)
        render(<SettingsPage />)

        expect(screen.queryByRole('button', { name: 'Добавить пасскей' })).not.toBeInTheDocument()
        expect(screen.getByText(/не поддерживает пасскеи/)).toBeInTheDocument()
    })
})
