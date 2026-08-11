import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventsPage } from '@/admin/pages/EventsPage'
import { listEvents, toggleEventDisabled, type AdminEventListItem } from '@/admin/lib/adminApi'

vi.mock('@/admin/lib/adminApi', () => ({
    listEvents: vi.fn(),
    toggleEventDisabled: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000

function makeEvent(over: Partial<AdminEventListItem> = {}): AdminEventListItem {
    return {
        id: 1,
        created_at: '2026-01-01T00:00:00Z',
        type: 'group_ride',
        title: 'Событие',
        description: null,
        photo_path: null,
        duration_minutes: null,
        location_text: null,
        start_coordinates: null,
        finish_coordinates: null,
        start_point_id: null,
        finish_point_id: null,
        flag_disabled: false,
        dates: [],
        ...over,
    }
}

function iso(offsetMs: number): string {
    return new Date(Date.now() + offsetMs).toISOString()
}

function renderPage() {
    return render(
        <MemoryRouter>
            <EventsPage />
        </MemoryRouter>,
    )
}

/** Названия событий в порядке строк таблицы. */
function rowTitles(): string[] {
    return screen
        .getAllByRole('row')
        .slice(1) // без заголовка
        .map((row) => within(row).getAllByRole('cell')[1]?.textContent ?? '')
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(toggleEventDisabled).mockResolvedValue(undefined)
})

describe('EventsPage', () => {
    it('по умолчанию показывает предстоящие события и прячет прошедшие', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                id: 1,
                title: 'Прошедшая',
                dates: [{ id: 'd1', starts_at: iso(-DAY), note: null, cancelled: false }],
            }),
            makeEvent({
                id: 2,
                title: 'Предстоящая',
                dates: [{ id: 'd2', starts_at: iso(DAY), note: null, cancelled: false }],
            }),
        ])

        renderPage()

        expect(await screen.findByText('Предстоящая')).toBeInTheDocument()
        expect(screen.queryByText('Прошедшая')).not.toBeInTheDocument()
    })

    it('сортирует предстоящие по ближайшей дате, а не по дате создания', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                id: 1,
                title: 'Через месяц',
                dates: [{ id: 'd1', starts_at: iso(30 * DAY), note: null, cancelled: false }],
            }),
            makeEvent({
                id: 2,
                title: 'Завтра',
                dates: [{ id: 'd2', starts_at: iso(DAY), note: null, cancelled: false }],
            }),
        ])

        renderPage()

        await screen.findByText('Завтра')
        expect(rowTitles()).toEqual(['Завтра', 'Через месяц'])
    })

    it('показывает ближайшую дату и счётчик дат', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                title: 'Еженедельная',
                dates: [
                    { id: 'd1', starts_at: iso(-DAY), note: null, cancelled: false },
                    { id: 'd2', starts_at: iso(DAY), note: 'Сбор у фонтана', cancelled: false },
                    { id: 'd3', starts_at: iso(8 * DAY), note: null, cancelled: true },
                ],
            }),
        ])

        renderPage()

        await screen.findByText('Еженедельная')
        const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
        // Ближайшая — будущая неотменённая, с заметкой (прошедшая и отменённая не в счёт).
        expect(cells[2]?.textContent).toContain('Сбор у фонтана')
        // 1 предстоящая из 3 всего, одна отменена.
        expect(cells[3]?.textContent).toContain('1 из 3')
        expect(cells[3]?.textContent).toContain('1 отм.')
    })

    it('событие без дат помечается «нет даты» и попадает в фильтр «Без даты»', async () => {
        vi.mocked(listEvents).mockResolvedValue([makeEvent({ title: 'Черновик', dates: [] })])

        renderPage()

        // По умолчанию активен фильтр «Предстоящие» — черновика там нет.
        await waitFor(() => {
            expect(screen.getByText(/Без даты \(1\)/)).toBeInTheDocument()
        })
        expect(screen.queryByText('Черновик')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Без даты/ }))

        expect(await screen.findByText('Черновик')).toBeInTheDocument()
        expect(screen.getByText('нет даты')).toBeInTheDocument()
    })

    it('событие только с отменёнными датами считается «без даты» — его легко не заметить', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                title: 'Всё отменено',
                dates: [{ id: 'd1', starts_at: iso(DAY), note: null, cancelled: true }],
            }),
        ])

        renderPage()

        await waitFor(() => {
            expect(screen.getByText(/Без даты \(1\)/)).toBeInTheDocument()
        })
        expect(screen.getByText(/Предстоящие \(0\)/)).toBeInTheDocument()
    })

    it('фильтр «Прошедшие» показывает недавние сверху', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                id: 1,
                title: 'Давно',
                dates: [{ id: 'd1', starts_at: iso(-30 * DAY), note: null, cancelled: false }],
            }),
            makeEvent({
                id: 2,
                title: 'Вчера',
                dates: [{ id: 'd2', starts_at: iso(-DAY), note: null, cancelled: false }],
            }),
        ])

        renderPage()

        await waitFor(() => {
            expect(screen.getByText(/Прошедшие \(2\)/)).toBeInTheDocument()
        })
        fireEvent.click(screen.getByRole('button', { name: /Прошедшие/ }))

        await screen.findByText('Вчера')
        expect(rowTitles()).toEqual(['Вчера', 'Давно'])
    })

    it('поиск фильтрует по названию и обновляет счётчики вкладок', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                id: 1,
                title: 'Вечерняя покатушка',
                dates: [{ id: 'd1', starts_at: iso(DAY), note: null, cancelled: false }],
            }),
            makeEvent({
                id: 2,
                title: 'Обучение новичков',
                dates: [{ id: 'd2', starts_at: iso(DAY), note: null, cancelled: false }],
            }),
        ])

        renderPage()

        await screen.findByText('Вечерняя покатушка')
        fireEvent.change(screen.getByPlaceholderText('Поиск по названию…'), { target: { value: 'обуч' } })

        expect(await screen.findByText('Обучение новичков')).toBeInTheDocument()
        expect(screen.queryByText('Вечерняя покатушка')).not.toBeInTheDocument()
        expect(screen.getByText(/Предстоящие \(1\)/)).toBeInTheDocument()
    })

    it('ошибку переключения видимости показывает в интерфейсе, а не в window.alert', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                title: 'Вечерний выезд',
                dates: [{ id: 'd1', starts_at: iso(DAY), note: null, cancelled: false }],
            }),
        ])
        vi.mocked(toggleEventDisabled).mockRejectedValue(new Error('RLS: нет прав'))
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'видно' }))

        expect(await screen.findByText('RLS: нет прав')).toBeInTheDocument()
        expect(alertSpy).not.toHaveBeenCalled()
        alertSpy.mockRestore()
    })

    it('на пустом списке предлагает создать первое событие', async () => {
        vi.mocked(listEvents).mockResolvedValue([])

        renderPage()

        expect(await screen.findByText('Событий пока нет.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Создать первое событие' })).toBeInTheDocument()
    })

    it('когда фильтр ничего не нашёл, отличает это от пустого списка', async () => {
        vi.mocked(listEvents).mockResolvedValue([
            makeEvent({
                title: 'Вечерний выезд',
                dates: [{ id: 'd1', starts_at: iso(DAY), note: null, cancelled: false }],
            }),
        ])

        renderPage()

        await screen.findByText('Вечерний выезд')
        fireEvent.change(screen.getByPlaceholderText('Поиск по названию…'), { target: { value: 'нет такого' } })

        expect(await screen.findByText(/Ничего не найдено/)).toBeInTheDocument()
        expect(screen.queryByText('Событий пока нет.')).not.toBeInTheDocument()
    })
})
