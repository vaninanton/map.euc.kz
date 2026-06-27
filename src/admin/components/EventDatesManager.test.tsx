import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EventDatesManager } from '@/admin/components/EventDatesManager'
import type { AdminEvent, AdminEventDate } from '@/admin/lib/adminApi'
import {
    cancelEventDateAnnouncements,
    listEventAnnouncements,
    listEventAnnouncementsForDates,
    listEventDates,
    listEventParticipants,
    listTelegramChats,
    updateEventDate,
} from '@/admin/lib/adminApi'

vi.mock('@/admin/lib/adminApi', () => ({
    addEventDate: vi.fn(),
    cancelEventDateAnnouncements: vi.fn(),
    deleteEventDate: vi.fn(),
    deleteEventDateAnnouncements: vi.fn(),
    editEventDateAnnouncements: vi.fn(),
    pinEventAnnouncement: vi.fn(),
    listEventAnnouncements: vi.fn(),
    listEventAnnouncementsForDates: vi.fn(),
    listEventDates: vi.fn(),
    listEventParticipants: vi.fn(),
    listTelegramChats: vi.fn(),
    announceEventDate: vi.fn(),
    updateEventDate: vi.fn(),
}))

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const EVENT: AdminEvent = {
    id: 5,
    created_at: '2026-01-01T00:00:00Z',
    type: 'training',
    title: 'Обучение',
    description: null,
    photo_path: null,
    duration_minutes: null,
    location_text: 'Сайран',
    start_coordinates: null,
    finish_coordinates: null,
    start_point_id: null,
    finish_point_id: null,
    flag_disabled: false,
}

function makeDate(over: Partial<AdminEventDate> = {}): AdminEventDate {
    return { id: 'date-1', starts_at: FUTURE, note: null, cancelled: false, ...over }
}

const announcedAnnouncement = {
    id: 'a1',
    created_at: '2026-01-01T00:00:00Z',
    event_date_id: 'date-1',
    telegram_chat_id: 131396,
    message_thread_id: null,
    telegram_message_id: 10,
    body_text: 'Сбор у фонтана',
    photo_path: null,
    sent_at: '2026-01-01T00:00:01Z',
    send_error: null,
    cancelled_at: null,
    deleted_at: null,
    pinned_at: null,
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listEventAnnouncementsForDates).mockResolvedValue([])
    vi.mocked(listEventAnnouncements).mockResolvedValue([])
    vi.mocked(listEventParticipants).mockResolvedValue([])
    vi.mocked(listTelegramChats).mockResolvedValue([])
})

describe('EventDatesManager', () => {
    it('показывает кнопку «Сообщить в Telegram» для будущей даты', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])

        render(<EventDatesManager event={EVENT} />)

        expect(await screen.findByText('Сообщить в Telegram')).toBeInTheDocument()
    })

    it('открывает модалку отправки с чекбоксами чатов', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])
        vi.mocked(listTelegramChats).mockResolvedValue([
            {
                id: 'd-personal',
                chat_id: 131396,
                title: 'Личка',
                enabled: true,
                sort_order: 0,
                created_at: 'x',
                message_thread_id: null,
            },
        ])

        render(<EventDatesManager event={EVENT} />)
        fireEvent.click(await screen.findByText('Сообщить в Telegram'))

        expect(await screen.findByText('Анонс в Telegram')).toBeInTheDocument()
        expect(await screen.findByText('Личка')).toBeInTheDocument()
    })

    it('показывает бейдж «Отправлено» и счётчик участников для анонсированной даты', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])
        vi.mocked(listEventAnnouncementsForDates).mockResolvedValue([announcedAnnouncement])
        vi.mocked(listEventParticipants).mockResolvedValue([
            {
                telegram_user_id: 1,
                created_at: 'x',
                username: 'rider',
                first_name: 'Иван',
                last_name: null,
                avatar_url: null,
            },
        ])

        render(<EventDatesManager event={EVENT} />)

        expect(await screen.findByText('Отправлено')).toBeInTheDocument()
        fireEvent.click(await screen.findByText(/Показать участников/))
        expect(await screen.findByText('Иван')).toBeInTheDocument()
        // username выводится отдельной ссылкой на профиль в Telegram
        const link = await screen.findByRole('link', { name: '@rider' })
        expect(link).toHaveAttribute('href', 'https://t.me/rider')
    })

    it('участник без username показывается без ссылки на профиль', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])
        vi.mocked(listEventAnnouncementsForDates).mockResolvedValue([announcedAnnouncement])
        vi.mocked(listEventParticipants).mockResolvedValue([
            {
                telegram_user_id: 2,
                created_at: 'x',
                username: null,
                first_name: 'Пётр',
                last_name: null,
                avatar_url: null,
            },
        ])

        render(<EventDatesManager event={EVENT} />)

        fireEvent.click(await screen.findByText(/Показать участников/))
        expect(await screen.findByText('Пётр')).toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('участник только с username показывает @username ссылкой без дублирования', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])
        vi.mocked(listEventAnnouncementsForDates).mockResolvedValue([announcedAnnouncement])
        vi.mocked(listEventParticipants).mockResolvedValue([
            {
                telegram_user_id: 3,
                created_at: 'x',
                username: 'solo',
                first_name: null,
                last_name: null,
                avatar_url: null,
            },
        ])

        render(<EventDatesManager event={EVENT} />)

        fireEvent.click(await screen.findByText(/Показать участников/))
        const links = await screen.findAllByRole('link', { name: '@solo' })
        expect(links).toHaveLength(1)
        expect(links[0]).toHaveAttribute('href', 'https://t.me/solo')
    })

    it('при отмене анонсированной даты вызывает cancelEventDateAnnouncements', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])
        vi.mocked(listEventAnnouncementsForDates).mockResolvedValue([announcedAnnouncement])
        vi.mocked(updateEventDate).mockResolvedValue(makeDate({ cancelled: true }))
        vi.mocked(cancelEventDateAnnouncements).mockResolvedValue({ cancelled: 1 })

        render(<EventDatesManager event={EVENT} />)

        // Входим в редактирование строки и отмечаем «Отменено».
        fireEvent.click(await screen.findByText('Изменить'))
        fireEvent.click(screen.getByLabelText('Отменено'))
        fireEvent.click(screen.getByText('Сохранить'))

        await waitFor(() => {
            expect(updateEventDate).toHaveBeenCalledWith('date-1', expect.objectContaining({ cancelled: true }))
            expect(cancelEventDateAnnouncements).toHaveBeenCalledWith('date-1')
        })
    })

    it('для анонсированной даты кнопка «Анонс в Telegram» открывает модалку управления', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])
        vi.mocked(listEventAnnouncementsForDates).mockResolvedValue([announcedAnnouncement])

        render(<EventDatesManager event={EVENT} />)

        fireEvent.click(await screen.findByText('Анонс в Telegram'))
        expect(await screen.findByRole('heading', { name: 'Изменить текст анонса' })).toBeInTheDocument()
        // в textarea подставляется сырое тело из body_text последнего живого анонса
        expect(await screen.findByDisplayValue('Сбор у фонтана')).toBeInTheDocument()
    })

    it('если все сообщения удалены (deleted_at) — дата снова считается неанонсированной', async () => {
        vi.mocked(listEventDates).mockResolvedValue([makeDate()])
        // была отправлена, но удалена из Telegram → не живая
        vi.mocked(listEventAnnouncementsForDates).mockResolvedValue([
            { ...announcedAnnouncement, deleted_at: '2026-01-02T00:00:00Z' },
        ])

        render(<EventDatesManager event={EVENT} />)

        // бейджа «Отправлено» нет, кнопка предлагает отправку, а не правку
        expect(await screen.findByText('Сообщить в Telegram')).toBeInTheDocument()
        expect(screen.queryByText('Отправлено')).not.toBeInTheDocument()
        expect(screen.queryByText('Анонс в Telegram')).not.toBeInTheDocument()
    })
})
