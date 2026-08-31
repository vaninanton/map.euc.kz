import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventForm, type EventFormValue } from '@/admin/components/EventForm'
import { listPoints } from '@/admin/lib/adminApi'
import { DEFAULT_EVENT_HOUR } from '@/admin/utils/eventDates'

vi.mock('@/admin/lib/adminApi', () => ({ listPoints: vi.fn() }))
// Мини-карта тянет mapbox-gl — в jsdom он не нужен, привязка точки здесь не тестируется.
vi.mock('@/admin/components/AdminPointLocationMap', () => ({
    AdminPointLocationMap: () => <div data-testid="point-map" />,
}))

const INITIAL: EventFormValue = {
    type: 'group_ride',
    title: '',
    description: null,
    duration_minutes: null,
    location_text: null,
    start_coordinates: null,
    finish_coordinates: null,
    start_point_id: null,
    finish_point_id: null,
    flag_disabled: false,
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listPoints).mockResolvedValue([])
})

describe('EventForm — первая дата при создании', () => {
    it('в режиме создания показывает блок даты, предзаполненный будущим вечерним слотом', () => {
        render(<EventForm initial={INITIAL} submitLabel="Создать" withFirstDate onSubmit={vi.fn()} />)

        const input = screen.getByLabelText<HTMLInputElement>('Когда')
        expect(input.value).not.toBe('')

        const prefilled = new Date(input.value)
        expect(prefilled.getHours()).toBe(DEFAULT_EVENT_HOUR)
        expect(prefilled.getTime()).toBeGreaterThan(Date.now())
    })

    it('в режиме редактирования блока даты нет — датами управляет EventDatesManager', () => {
        render(<EventForm initial={INITIAL} submitLabel="Сохранить" onSubmit={vi.fn()} />)

        expect(screen.queryByLabelText('Когда')).not.toBeInTheDocument()
        expect(screen.queryByText('Дата проведения')).not.toBeInTheDocument()
    })

    it('передаёт дату и заметку в onSubmit вместе с полями события', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(<EventForm initial={INITIAL} submitLabel="Создать" withFirstDate onSubmit={onSubmit} />)

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Вечерняя покатушка' } })
        fireEvent.change(screen.getByLabelText('Когда'), { target: { value: '2026-09-01T19:30' } })
        fireEvent.change(screen.getByLabelText('Заметка (необязательно)'), { target: { value: 'Сбор у фонтана' } })
        fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1)
        })
        const [value, firstDate] = onSubmit.mock.calls[0] as [
            EventFormValue,
            { starts_at: string; note: string | null },
        ]
        expect(value.title).toBe('Вечерняя покатушка')
        expect(firstDate.note).toBe('Сбор у фонтана')
        expect(new Date(firstDate.starts_at).getTime()).toBe(new Date('2026-09-01T19:30').getTime())
    })

    it('пустая заметка уходит как null, а не пустая строка', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(<EventForm initial={INITIAL} submitLabel="Создать" withFirstDate onSubmit={onSubmit} />)

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Покатушка' } })
        fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1)
        })
        const [, firstDate] = onSubmit.mock.calls[0] as [EventFormValue, { note: string | null }]
        expect(firstDate.note).toBeNull()
    })

    it('без даты не отправляет форму и показывает ошибку', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(<EventForm initial={INITIAL} submitLabel="Создать" withFirstDate onSubmit={onSubmit} />)

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Покатушка' } })
        fireEvent.change(screen.getByLabelText('Когда'), { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

        expect(await screen.findByText('Укажите дату и время проведения.')).toBeInTheDocument()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('в режиме редактирования onSubmit получает null вместо даты', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(<EventForm initial={INITIAL} submitLabel="Сохранить" onSubmit={onSubmit} />)

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Покатушка' } })
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1)
        })
        expect(onSubmit.mock.calls[0]?.[1]).toBeNull()
    })

    it('предупреждает о дате в прошлом, но не блокирует отправку', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(<EventForm initial={INITIAL} submitLabel="Создать" withFirstDate onSubmit={onSubmit} />)

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Архивная покатушка' } })
        fireEvent.change(screen.getByLabelText('Когда'), { target: { value: '2020-01-01T19:00' } })

        expect(screen.getByText(/Дата в прошлом/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Создать' }))
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1)
        })
    })

    it('короткое название не проходит валидацию раньше проверки даты', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(<EventForm initial={INITIAL} submitLabel="Создать" withFirstDate onSubmit={onSubmit} />)

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Ку' } })
        fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

        expect(await screen.findByText(/от 4 до 99 символов/)).toBeInTheDocument()
        expect(onSubmit).not.toHaveBeenCalled()
    })
})
