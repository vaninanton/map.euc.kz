import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EventCard } from './EventCard'
import { dateAt, eventDate, makeEvent } from '@/test/eventFactories'
import type { EventRow } from '@/types'

function renderCard(event: EventRow) {
    return render(
        <MemoryRouter>
            <EventCard event={event} />
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

    it('вся карточка — ссылка на страницу события /events/:id', () => {
        renderCard(cardEvent({ id: 'e9' }))

        const link = screen.getByRole('link', { name: /Вечерняя покатушка/ })
        expect(link).toHaveAttribute('href', expect.stringContaining('/events/e9'))
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

    it('показывает текстовое место, если оно задано без привязанной точки-старта', () => {
        renderCard(cardEvent({ location_text: 'У главного входа' }))

        expect(screen.getByText('У главного входа')).toBeInTheDocument()
    })
})
