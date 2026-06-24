import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EventDetailScreen } from './EventDetailScreen'
import { dateAt, eventDate, makeEvent } from '@/test/eventFactories'
import type { EventRow } from '@/types'

const user = userEvent.setup({ delay: null })

interface Overrides {
    event?: EventRow | null
    loading?: boolean
    error?: string | null
    onClose?: () => void
    onShowOnMap?: (c: [number, number]) => void
}

function renderDetail(o: Overrides = {}) {
    const onClose = o.onClose ?? vi.fn()
    const onShowOnMap = o.onShowOnMap ?? vi.fn()
    const result = render(
        <MemoryRouter>
            <EventDetailScreen
                event={o.event === undefined ? detailEvent() : o.event}
                loading={o.loading ?? false}
                error={o.error ?? null}
                onClose={onClose}
                onShowOnMap={onShowOnMap}
            />
        </MemoryRouter>,
    )
    return { onClose, onShowOnMap, container: result.container }
}

function detailEvent(overrides: Partial<EventRow> = {}): EventRow {
    return makeEvent({
        id: 'e9',
        title: 'Вечерняя покатушка',
        description: 'Сбор у фонтана',
        dates: [eventDate({ starts_at: dateAt(2) })],
        ...overrides,
    })
}

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-23T12:00:00'))
})

afterEach(() => {
    vi.useRealTimers()
})

describe('EventDetailScreen', () => {
    it('показывает заголовок, тип и описание события', () => {
        renderDetail()

        expect(screen.getByRole('heading', { name: 'Вечерняя покатушка', level: 2 })).toBeInTheDocument()
        expect(screen.getByText('Покатушка')).toBeInTheDocument()
        expect(screen.getByText('Сбор у фонтана')).toBeInTheDocument()
    })

    it('прогоняет описание через типограф (кавычки-«ёлочки», тире)', () => {
        const { container } = renderDetail({ event: detailEvent({ description: 'Сбор у "фонтана" - бесплатно' }) })

        const html = container.innerHTML
        expect(html).toContain('«фонтана»')
        expect(html).toContain('—')
        expect(html).not.toContain('"фонтана"')
    })

    it('показывает список ближайших дат', () => {
        renderDetail({
            event: detailEvent({
                dates: [eventDate({ id: 'd1', starts_at: dateAt(2) }), eventDate({ id: 'd2', starts_at: dateAt(9) })],
            }),
        })

        // Две будущие даты в расписании.
        const items = screen.getAllByRole('listitem')
        expect(items).toHaveLength(2)
    })

    it('кнопка «Поделиться» ведёт на t.me/share с deep-link события', () => {
        renderDetail()

        const link = screen.getByRole('link', { name: 'Поделиться в Telegram' })
        const href = link.getAttribute('href') ?? ''
        expect(href).toContain('t.me/share/url')
        expect(decodeURIComponent(href)).toContain('events/e9')
        expect(decodeURIComponent(href)).toContain('Вечерняя+покатушка')
    })

    it('кнопка «Назад» вызывает onClose', async () => {
        const onClose = vi.fn()
        renderDetail({ onClose })

        await user.click(screen.getByRole('button', { name: 'Назад' }))

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('для ручных координат старта показывает кнопку и вызывает onShowOnMap', async () => {
        const onShowOnMap = vi.fn()
        renderDetail({ event: detailEvent({ start_coordinates: [76.9, 43.2] }), onShowOnMap })

        await user.click(screen.getByRole('button', { name: 'Показать на карте' }))

        expect(onShowOnMap).toHaveBeenCalledWith([76.9, 43.2])
    })

    it('рендерит привязанную точку-старт ссылкой на её карточку', () => {
        renderDetail({
            event: detailEvent({ start_point: { id: 'p7', title: 'Парк Горького', coordinates: [76.95, 43.25] } }),
        })

        const link = screen.getByRole('link', { name: /Парк Горького/ })
        expect(link).toHaveAttribute('href', expect.stringContaining('/m/point/p7'))
    })

    it('показывает состояние загрузки, когда события ещё нет', () => {
        renderDetail({ event: null, loading: true })

        expect(screen.getByText('Загрузка события…')).toBeInTheDocument()
    })

    it('показывает «Событие не найдено», когда загрузка завершена и события нет', () => {
        renderDetail({ event: null, loading: false })

        expect(screen.getByText('Событие не найдено')).toBeInTheDocument()
    })
})
