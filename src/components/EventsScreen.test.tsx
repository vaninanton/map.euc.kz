import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EventsScreen } from './EventsScreen'
import { dateAt, eventDate, makeEvent } from '@/test/eventFactories'
import type { EventRow, EventType } from '@/types'

const user = userEvent.setup({ delay: null })

function screenEvent(id: string, type: EventType, title: string, daysFromNow = 2): EventRow {
    return makeEvent({ id, type, title, dates: [eventDate({ id: `${id}-d`, starts_at: dateAt(daysFromNow) })] })
}

const EVENTS = [
    screenEvent('ride', 'group_ride', 'Покатушка вечером', 5),
    screenEvent('train', 'training', 'Обучение новичков', 2),
    screenEvent('meet', 'event', 'Большая встреча', 10),
]

interface Overrides {
    events?: EventRow[]
    loading?: boolean
    error?: string | null
    onMarkAsRead?: () => void
    onClose?: () => void
}

function renderScreen(o: Overrides = {}) {
    const onMarkAsRead = o.onMarkAsRead ?? vi.fn()
    const onClose = o.onClose ?? vi.fn()
    render(
        <MemoryRouter>
            <EventsScreen
                events={o.events ?? EVENTS}
                loading={o.loading ?? false}
                error={o.error ?? null}
                onMarkAsRead={onMarkAsRead}
                onClose={onClose}
            />
        </MemoryRouter>,
    )
    return { onMarkAsRead, onClose }
}

// shouldAdvanceTime — userEvent работает без перехода на реальные таймеры,
// при этом setSystemTime фиксирует «сейчас» для сортировки по ближайшей дате.
beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-23T12:00:00'))
})

afterEach(() => {
    vi.useRealTimers()
})

describe('EventsScreen', () => {
    it('вызывает onMarkAsRead один раз при открытии', () => {
        const onMarkAsRead = vi.fn()
        renderScreen({ onMarkAsRead })

        expect(onMarkAsRead).toHaveBeenCalledTimes(1)
    })

    it('показывает все события и их количество в шапке', () => {
        renderScreen()

        expect(screen.getByRole('heading', { name: 'Покатушка вечером' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Большая встреча' })).toBeInTheDocument()
    })

    it('сортирует события по ближайшей дате', () => {
        renderScreen()

        const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
        // train(+2) < ride(+5) < meet(+10)
        expect(headings).toEqual(['Обучение новичков', 'Покатушка вечером', 'Большая встреча'])
    })

    it('фильтрует по типу события', async () => {
        renderScreen()

        await user.click(screen.getByRole('button', { name: 'Обучение' }))

        expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Покатушка вечером' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Большая встреча' })).not.toBeInTheDocument()
    })

    it('фильтр «Все» возвращает все события', async () => {
        renderScreen()

        await user.click(screen.getByRole('button', { name: 'Покатушка' }))
        expect(screen.queryByRole('heading', { name: 'Обучение новичков' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Все' }))
        expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeInTheDocument()
    })

    it('вызывает onClose по кнопке «Закрыть»', async () => {
        const onClose = vi.fn()
        renderScreen({ onClose })

        await user.click(screen.getByRole('button', { name: 'Закрыть' }))

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('показывает состояние загрузки', () => {
        renderScreen({ events: [], loading: true })

        expect(screen.getByText('Загрузка событий…')).toBeInTheDocument()
    })

    it('показывает ошибку и не показывает индикатор загрузки', () => {
        renderScreen({ events: [], loading: true, error: 'Не удалось загрузить' })

        expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument()
        expect(screen.queryByText('Загрузка событий…')).not.toBeInTheDocument()
    })

    it('показывает пустое состояние, когда событий нет', () => {
        renderScreen({ events: [] })

        expect(screen.getByText('Пока нет событий')).toBeInTheDocument()
    })

    it('карточки события ведут на страницу /events/:id', () => {
        renderScreen()

        const link = screen.getByRole('link', { name: /Большая встреча/ })
        expect(link).toHaveAttribute('href', expect.stringContaining('/events/meet'))
    })
})
