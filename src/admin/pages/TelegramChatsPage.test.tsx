import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TelegramChatsPage } from '@/admin/pages/TelegramChatsPage'
import { createTelegramChat, deleteTelegramChat, updateTelegramChat } from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'

vi.mock('@/admin/lib/adminApi', () => ({
    listTelegramChats: vi.fn(),
    createTelegramChat: vi.fn(),
    updateTelegramChat: vi.fn(),
    deleteTelegramChat: vi.fn(),
}))

vi.mock('@/admin/hooks/useAdminListLoader', () => ({
    useAdminListLoader: vi.fn(),
}))

const CHAT = {
    id: 'd-1',
    chat_id: 131396,
    title: 'Личка',
    enabled: true,
    sort_order: 0,
    created_at: 'x',
    message_thread_id: null,
}

function setupLoader(chats = [CHAT]) {
    const reload = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAdminListLoader).mockReturnValue({
        items: chats,
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
})

describe('TelegramChatsPage', () => {
    it('рендерит список чатов', () => {
        setupLoader()
        render(<TelegramChatsPage />)
        expect(screen.getByText('Личка')).toBeInTheDocument()
        expect(screen.getByText('131396')).toBeInTheDocument()
    })

    it('переключает enabled', async () => {
        const { reload } = setupLoader()
        vi.mocked(updateTelegramChat).mockResolvedValue({ ...CHAT, enabled: false })
        render(<TelegramChatsPage />)

        fireEvent.click(screen.getByText('включён'))

        await waitFor(() => {
            expect(updateTelegramChat).toHaveBeenCalledWith('d-1', { enabled: false })
            expect(reload).toHaveBeenCalled()
        })
    })

    it('добавляет чат из формы', async () => {
        const { reload } = setupLoader([])
        vi.mocked(createTelegramChat).mockResolvedValue(CHAT)
        render(<TelegramChatsPage />)

        fireEvent.change(screen.getByPlaceholderText('131396 или -100…'), { target: { value: '-100500' } })
        fireEvent.change(screen.getByPlaceholderText('Моноколёса Алматы'), { target: { value: 'Группа' } })
        fireEvent.click(screen.getByText('Добавить'))

        await waitFor(() => {
            expect(createTelegramChat).toHaveBeenCalledWith(
                expect.objectContaining({ chat_id: -100500, title: 'Группа', enabled: true, message_thread_id: null }),
            )
            expect(reload).toHaveBeenCalled()
        })
    })

    it('прокидывает message_thread_id из формы', async () => {
        const { reload } = setupLoader([])
        vi.mocked(createTelegramChat).mockResolvedValue(CHAT)
        render(<TelegramChatsPage />)

        fireEvent.change(screen.getByPlaceholderText('131396 или -100…'), { target: { value: '-100500' } })
        fireEvent.change(screen.getByPlaceholderText('Моноколёса Алматы'), { target: { value: 'Форум' } })
        fireEvent.change(screen.getByPlaceholderText('ID темы форума'), { target: { value: '17' } })
        fireEvent.click(screen.getByText('Добавить'))

        await waitFor(() => {
            expect(createTelegramChat).toHaveBeenCalledWith(expect.objectContaining({ message_thread_id: 17 }))
            expect(reload).toHaveBeenCalled()
        })
    })

    it('удаляет чат после подтверждения', async () => {
        const { reload } = setupLoader()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        vi.mocked(deleteTelegramChat).mockResolvedValue(undefined)
        render(<TelegramChatsPage />)

        fireEvent.click(screen.getByText('Удалить'))

        await waitFor(() => {
            expect(deleteTelegramChat).toHaveBeenCalledWith('d-1')
            expect(reload).toHaveBeenCalled()
        })
    })
})
