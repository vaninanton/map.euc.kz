import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EventAnnounceModal } from '@/admin/components/EventAnnounceModal'
import * as adminApi from '@/admin/lib/adminApi'
import type { AdminEvent, AdminEventDate, AdminTelegramChat } from '@/admin/lib/adminApi'

vi.mock('@/admin/lib/adminApi', () => ({
    announceEventDate: vi.fn(),
    editEventDateAnnouncements: vi.fn(),
    deleteEventDateAnnouncements: vi.fn(),
    pinEventAnnouncement: vi.fn(),
    listEventAnnouncements: vi.fn(),
    listTelegramChats: vi.fn(),
}))

const EVENT: AdminEvent = {
    id: 7,
    created_at: '2026-06-01T00:00:00Z',
    type: 'group_ride',
    title: 'Вечерняя покатушка',
    description: null,
    photo_path: null,
    duration_minutes: null,
    location_text: null,
    start_coordinates: null,
    finish_coordinates: null,
    start_point_id: null,
    finish_point_id: null,
    flag_disabled: false,
}

const DATE: AdminEventDate = {
    id: '11111111-2222-3333-4444-555555555555',
    starts_at: '2026-07-14T19:00:00Z',
    note: null,
    cancelled: false,
}

const CHAT: AdminTelegramChat = {
    id: 'd-200',
    chat_id: -200,
    title: 'Моноколёса Алматы',
    enabled: true,
    sort_order: 0,
    created_at: '2026-06-01T00:00:00Z',
    message_thread_id: null,
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminApi.listTelegramChats).mockResolvedValue([CHAT])
    vi.mocked(adminApi.announceEventDate).mockResolvedValue({ sent: [], failed: [] })
    vi.mocked(adminApi.editEventDateAnnouncements).mockResolvedValue({ edited: 1, failed: [] })
    vi.mocked(adminApi.deleteEventDateAnnouncements).mockResolvedValue({ deleted: 1 })
    vi.mocked(adminApi.listEventAnnouncements).mockResolvedValue([])
})

/** Дожидается загрузки чатов (исчезновение «Загрузка чатов…»). */
async function renderAndLoad() {
    render(<EventAnnounceModal event={EVENT} date={DATE} onClose={vi.fn()} onSent={vi.fn()} />)
    await waitFor(() => {
        expect(screen.getByText(CHAT.title)).toBeInTheDocument()
    })
}

describe('EventAnnounceModal — закрепление', () => {
    it('по умолчанию чекбокс выключен и announceEventDate вызывается с pin=false', async () => {
        await renderAndLoad()

        expect(screen.getByLabelText('Закрепить сообщение в чате')).not.toBeChecked()

        fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))

        await waitFor(() => {
            expect(adminApi.announceEventDate).toHaveBeenCalledWith(DATE.id, expect.any(String), [CHAT.id], false)
        })
    })

    it('при включённом чекбоксе announceEventDate вызывается с pin=true', async () => {
        await renderAndLoad()

        fireEvent.click(screen.getByLabelText('Закрепить сообщение в чате'))
        fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))

        await waitFor(() => {
            expect(adminApi.announceEventDate).toHaveBeenCalledWith(DATE.id, expect.any(String), [CHAT.id], true)
        })
    })
})

describe('EventAnnounceModal — режим правки', () => {
    it('не показывает блок первичной отправки («Куда отправить») и pin, вызывает editEventDateAnnouncements', async () => {
        render(<EventAnnounceModal event={EVENT} date={DATE} mode="edit" onClose={vi.fn()} onSent={vi.fn()} />)

        // блок первичной отправки и закрепление — только в режиме send
        expect(screen.queryByText('Куда отправить')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Закрепить сообщение в чате')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        await waitFor(() => {
            expect(adminApi.editEventDateAnnouncements).toHaveBeenCalledWith(DATE.id, expect.any(String))
        })
        expect(adminApi.announceEventDate).not.toHaveBeenCalled()
    })

    it('показывает чаты, куда ещё не отправлено, и до-отправляет текущий текст через announceEventDate', async () => {
        // CHAT ещё не получал анонс (listEventAnnouncements пустой) → он в списке «новых».
        const onSent = vi.fn()
        render(<EventAnnounceModal event={EVENT} date={DATE} mode="edit" onClose={vi.fn()} onSent={onSent} />)

        // дожидаемся появления блока до-отправки с чатом
        const sendNewBtn = await screen.findByRole('button', {
            name: 'Отправить текущий текст в выбранные чаты',
        })
        // выбираем чат (по умолчанию выбор пуст) и отправляем
        fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(CHAT.title) }))
        fireEvent.click(sendNewBtn)

        await waitFor(() => {
            expect(adminApi.announceEventDate).toHaveBeenCalledWith(DATE.id, expect.any(String), [CHAT.id], false)
        })
        expect(onSent).toHaveBeenCalled()
    })

    it('до-отправка недоступна, пока чат не выбран (выбор пуст по умолчанию)', async () => {
        render(<EventAnnounceModal event={EVENT} date={DATE} mode="edit" onClose={vi.fn()} onSent={vi.fn()} />)
        const sendNewBtn = await screen.findByRole('button', {
            name: 'Отправить текущий текст в выбранные чаты',
        })
        expect(sendNewBtn).toBeDisabled()
    })

    it('заголовок модалки — «Изменить текст анонса»', () => {
        render(<EventAnnounceModal event={EVENT} date={DATE} mode="edit" onClose={vi.fn()} onSent={vi.fn()} />)
        expect(screen.getByRole('heading', { name: 'Изменить текст анонса' })).toBeInTheDocument()
    })

    it('кнопка «Удалить из Telegram» есть только в режиме правки', () => {
        const { rerender } = render(
            <EventAnnounceModal event={EVENT} date={DATE} mode="send" onClose={vi.fn()} onSent={vi.fn()} />,
        )
        expect(screen.queryByRole('button', { name: 'Удалить из Telegram' })).not.toBeInTheDocument()

        rerender(<EventAnnounceModal event={EVENT} date={DATE} mode="edit" onClose={vi.fn()} onSent={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Удалить из Telegram' })).toBeInTheDocument()
    })

    it('«Удалить из Telegram» с подтверждением вызывает deleteEventDateAnnouncements и onSent', async () => {
        const onSent = vi.fn()
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
        render(<EventAnnounceModal event={EVENT} date={DATE} mode="edit" onClose={vi.fn()} onSent={onSent} />)

        fireEvent.click(screen.getByRole('button', { name: 'Удалить из Telegram' }))

        await waitFor(() => {
            expect(adminApi.deleteEventDateAnnouncements).toHaveBeenCalledWith(DATE.id)
        })
        expect(onSent).toHaveBeenCalledWith({ deleted: 1 })
        confirmSpy.mockRestore()
    })

    it('«Удалить из Telegram» без подтверждения не вызывает API', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
        render(<EventAnnounceModal event={EVENT} date={DATE} mode="edit" onClose={vi.fn()} onSent={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Удалить из Telegram' }))

        expect(adminApi.deleteEventDateAnnouncements).not.toHaveBeenCalled()
        confirmSpy.mockRestore()
    })
})
