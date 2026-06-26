import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AnnouncementMessagesList } from '@/admin/components/AnnouncementMessagesList'
import * as adminApi from '@/admin/lib/adminApi'
import type { AdminEventAnnouncement } from '@/admin/lib/adminApi'

vi.mock('@/admin/lib/adminApi', () => ({
    listEventAnnouncements: vi.fn(),
    listTelegramChats: vi.fn(),
    pinEventAnnouncement: vi.fn(),
}))

const DATE_ID = '11111111-2222-3333-4444-555555555555'

function makeAnn(over: Partial<AdminEventAnnouncement> = {}): AdminEventAnnouncement {
    return {
        id: 'a1',
        created_at: '2026-07-01T10:00:00Z',
        event_date_id: DATE_ID,
        telegram_chat_id: -200,
        message_thread_id: null,
        telegram_message_id: 42,
        body_text: 'Сбор',
        photo_path: null,
        sent_at: '2026-07-01T10:00:01Z',
        send_error: null,
        cancelled_at: null,
        deleted_at: null,
        pinned_at: null,
        ...over,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminApi.listTelegramChats).mockResolvedValue([
        {
            id: 'd-200',
            chat_id: -200,
            title: 'Моноколёса Алматы',
            enabled: true,
            sort_order: 0,
            created_at: 'x',
            message_thread_id: null,
        },
    ])
    vi.mocked(adminApi.pinEventAnnouncement).mockResolvedValue({ pinned: true })
})

describe('AnnouncementMessagesList', () => {
    it('показывает имя чата (из telegram_chats) и кнопку «Закрепить» для живого сообщения', async () => {
        vi.mocked(adminApi.listEventAnnouncements).mockResolvedValue([makeAnn()])

        render(<AnnouncementMessagesList eventDateId={DATE_ID} />)

        expect(await screen.findByText('Моноколёса Алматы')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Закрепить' })).toBeInTheDocument()
    })

    it('fallback на chat_id, если чат не найден в telegram_chats', async () => {
        vi.mocked(adminApi.listEventAnnouncements).mockResolvedValue([makeAnn({ telegram_chat_id: -999 })])

        render(<AnnouncementMessagesList eventDateId={DATE_ID} />)

        expect(await screen.findByText('-999')).toBeInTheDocument()
    })

    it('закреплённое сообщение показывает бейдж и кнопку «Открепить»', async () => {
        vi.mocked(adminApi.listEventAnnouncements).mockResolvedValue([makeAnn({ pinned_at: '2026-07-01T11:00:00Z' })])

        render(<AnnouncementMessagesList eventDateId={DATE_ID} />)

        expect(await screen.findByText('📌 Закреплено')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Открепить' })).toBeInTheDocument()
    })

    it('клик «Закрепить» вызывает pinEventAnnouncement(id, true) и обновляет кнопку', async () => {
        vi.mocked(adminApi.listEventAnnouncements).mockResolvedValue([makeAnn()])

        render(<AnnouncementMessagesList eventDateId={DATE_ID} />)
        fireEvent.click(await screen.findByRole('button', { name: 'Закрепить' }))

        await waitFor(() => {
            expect(adminApi.pinEventAnnouncement).toHaveBeenCalledWith('a1', true)
        })
        // после успеха кнопка становится «Открепить»
        expect(await screen.findByRole('button', { name: 'Открепить' })).toBeInTheDocument()
    })

    it('удалённое сообщение — бейдж «Удалено», без кнопки закрепления', async () => {
        vi.mocked(adminApi.listEventAnnouncements).mockResolvedValue([makeAnn({ deleted_at: '2026-07-01T12:00:00Z' })])

        render(<AnnouncementMessagesList eventDateId={DATE_ID} />)

        expect(await screen.findByText('Удалено')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Закрепить' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Открепить' })).not.toBeInTheDocument()
    })

    it('сообщение с ошибкой отправки — бейдж «Ошибка»', async () => {
        vi.mocked(adminApi.listEventAnnouncements).mockResolvedValue([
            makeAnn({ telegram_message_id: null, send_error: 'blocked' }),
        ])

        render(<AnnouncementMessagesList eventDateId={DATE_ID} />)

        expect(await screen.findByText('Ошибка')).toBeInTheDocument()
    })
})
