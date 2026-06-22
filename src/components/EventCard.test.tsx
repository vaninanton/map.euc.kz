import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EventCard } from './EventCard'
import { dateAt, eventDate, makeEvent } from '@/test/eventFactories'
import type { EventRow } from '@/types'

const user = userEvent.setup({ delay: null })

function renderCard(event: EventRow, onShowCoordinates?: (c: [number, number]) => void) {
    return render(
        <MemoryRouter>
            <EventCard event={event} onShowCoordinates={onShowCoordinates} />
        </MemoryRouter>,
    )
}

/** Событие карточки с фиксированным названием и одной будущей датой по умолчанию. */
function cardEvent(overrides: Partial<EventRow> = {}): EventRow {
    return makeEvent({ title: 'Вечерняя покатушка', dates: [eventDate({ starts_at: dateAt(2) })], ...overrides })
}

// shouldAdvanceTime — userEvent работает без перехода на реальные таймеры,
// при этом setSystemTime фиксирует «сейчас» для меток расписания.
beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-23T12:00:00'))
})

afterEach(() => {
    vi.useRealTimers()
})

describe('EventCard', () => {
    it('показывает заголовок, тип и описание', () => {
        renderCard(cardEvent({ description: 'Сбор у фонтана' }))

        expect(screen.getByRole('heading', { name: 'Вечерняя покатушка' })).toBeInTheDocument()
        expect(screen.getByText('Покатушка')).toBeInTheDocument()
        expect(screen.getByText('Сбор у фонтана')).toBeInTheDocument()
    })

    it('показывает фото, когда задан photo_url', () => {
        renderCard(cardEvent({ photo_url: 'https://cdn/p.jpg' }))

        const img = screen.getByRole('img', { name: 'Вечерняя покатушка' })
        expect(img).toHaveAttribute('src', 'https://cdn/p.jpg')
    })

    it('показывает индикатор «Сейчас» для идущего события', () => {
        // Старт 30 мин назад, длительность 90 мин — событие идёт прямо сейчас.
        const startedAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        renderCard(cardEvent({ duration_minutes: 90, dates: [eventDate({ starts_at: startedAgo })] }))

        expect(screen.getByText('Сейчас')).toBeInTheDocument()
    })

    it('показывает «Событие прошло», если все даты в прошлом', () => {
        renderCard(cardEvent({ dates: [eventDate({ starts_at: dateAt(-5) })] }))

        expect(screen.getByText('Событие прошло')).toBeInTheDocument()
    })

    it('рендерит привязанную точку-старт ссылкой на её карточку', () => {
        renderCard(cardEvent({ start_point: { id: 'p7', title: 'Парк Горького', coordinates: [76.95, 43.25] } }))

        const link = screen.getByRole('link', { name: /Парк Горького/ })
        expect(link).toHaveAttribute('href', expect.stringContaining('/m/point/p7'))
    })

    it('подменяет подпись старта текстовым местом, если у точки-старта есть location_text', () => {
        renderCard(
            cardEvent({
                start_point: { id: 'p7', title: 'Парк Горького', coordinates: [76.95, 43.25] },
                location_text: 'У главного входа',
            }),
        )

        const link = screen.getByRole('link', { name: /У главного входа/ })
        expect(link).toBeInTheDocument()
        // location_text ушёл в подпись кнопки, отдельной строкой места его нет.
        expect(screen.queryByText('У главного входа', { selector: 'span' })).not.toBeInTheDocument()
    })

    it('для ручных координат старта показывает кнопку и вызывает onShowCoordinates', async () => {
        const onShow = vi.fn()
        renderCard(cardEvent({ start_coordinates: [76.9, 43.2] }), onShow)

        const btn = screen.getByRole('button', { name: 'Старт на карте' })
        await user.click(btn)

        expect(onShow).toHaveBeenCalledWith([76.9, 43.2])
    })

    it('не показывает кнопки старта/финиша, если нет ни точек, ни координат', () => {
        renderCard(cardEvent())

        expect(screen.queryByRole('button', { name: 'Старт на карте' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Финиш на карте' })).not.toBeInTheDocument()
    })
})
