import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EventDatesManager } from '@/admin/components/EventDatesManager'
import type { AdminEvent, AdminEventDate } from '@/admin/lib/adminApi'
import {
    addEventDate,
    cancelEventDateAnnouncements,
    deleteEventDate,
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
const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

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

    describe('удаление даты', () => {
        it('по клику на «Удалить» показывает подтверждение и НЕ удаляет сразу', async () => {
            vi.mocked(listEventDates).mockResolvedValue([makeDate()])

            render(<EventDatesManager event={EVENT} />)

            fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }))

            expect(await screen.findByText('Удалить дату?')).toBeInTheDocument()
            expect(deleteEventDate).not.toHaveBeenCalled()
        })

        it('удаляет дату только после подтверждения в диалоге', async () => {
            vi.mocked(listEventDates).mockResolvedValue([makeDate()])
            vi.mocked(deleteEventDate).mockResolvedValue(undefined)

            render(<EventDatesManager event={EVENT} />)

            fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }))
            await screen.findByText('Удалить дату?')

            // В строке и в диалоге кнопки называются одинаково — подтверждающая идёт последней.
            const buttons = screen.getAllByRole('button', { name: 'Удалить' })
            fireEvent.click(buttons[buttons.length - 1])

            await waitFor(() => {
                expect(deleteEventDate).toHaveBeenCalledWith('date-1')
            })
        })

        it('по «Отмена» в диалоге дату не удаляет', async () => {
            vi.mocked(listEventDates).mockResolvedValue([makeDate()])

            render(<EventDatesManager event={EVENT} />)

            fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }))
            await screen.findByText('Удалить дату?')
            fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

            await waitFor(() => {
                expect(screen.queryByText('Удалить дату?')).not.toBeInTheDocument()
            })
            expect(deleteEventDate).not.toHaveBeenCalled()
        })
    })

    describe('прошедшие даты', () => {
        it('скрыты по умолчанию и раскрываются кнопкой', async () => {
            vi.mocked(listEventDates).mockResolvedValue([
                makeDate({ id: 'past-1', starts_at: PAST, note: 'Прошлая покатушка' }),
                makeDate({ id: 'future-1', note: 'Будущая покатушка' }),
            ])

            render(<EventDatesManager event={EVENT} />)

            expect(await screen.findByText(/Будущая покатушка/)).toBeInTheDocument()
            expect(screen.queryByText(/Прошлая покатушка/)).not.toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Показать прошедшие (1)' }))

            expect(await screen.findByText(/Прошлая покатушка/)).toBeInTheDocument()
        })

        it('без прошедших дат кнопка-раскрывашка не показывается', async () => {
            vi.mocked(listEventDates).mockResolvedValue([makeDate()])

            render(<EventDatesManager event={EVENT} />)

            await screen.findByText('Сообщить в Telegram')
            expect(screen.queryByText(/Показать прошедшие/)).not.toBeInTheDocument()
        })
    })

    describe('кнопка «+1 неделя»', () => {
        it('добавляет дату на неделю позже последней, копируя заметку', async () => {
            const last = makeDate({ id: 'last', starts_at: FUTURE, note: 'Сбор у фонтана' })
            vi.mocked(listEventDates).mockResolvedValue([last])
            vi.mocked(addEventDate).mockResolvedValue(last)

            render(<EventDatesManager event={EVENT} />)

            fireEvent.click(await screen.findByRole('button', { name: '+1 неделя' }))

            await waitFor(() => {
                expect(addEventDate).toHaveBeenCalledTimes(1)
            })
            const [eventId, input] = vi.mocked(addEventDate).mock.calls[0] as [
                number,
                { starts_at: string; note: string | null },
            ]
            expect(eventId).toBe(EVENT.id)
            expect(input.note).toBe('Сбор у фонтана')
            const expected = new Date(FUTURE)
            expected.setDate(expected.getDate() + 7)
            expect(new Date(input.starts_at).getTime()).toBe(expected.getTime())
        })

        it('не показывается, пока у события нет ни одной даты', async () => {
            vi.mocked(listEventDates).mockResolvedValue([])

            render(<EventDatesManager event={EVENT} />)

            expect(await screen.findByText('Дат пока нет.')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: '+1 неделя' })).not.toBeInTheDocument()
        })
    })
})
