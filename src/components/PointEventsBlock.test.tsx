import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PointEventsBlock } from './PointEventsBlock'
import { dateAt, eventDate, makeEvent } from '@/test/eventFactories'
import type { EventRow, EventType } from '@/types'

const user = userEvent.setup({ delay: null })

function blockEvent(
    id: string,
    type: EventType,
    title: string,
    startsAt: string,
    durationMinutes: number | null = null,
): EventRow {
    return makeEvent({
        id,
        type,
        title,
        duration_minutes: durationMinutes,
        dates: [eventDate({ id: `${id}-d`, starts_at: startsAt })],
    })
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

describe('PointEventsBlock', () => {
    it('показывает заголовок блока и название события в кнопке', () => {
        render(<PointEventsBlock events={[blockEvent('e1', 'group_ride', 'Вечерний заезд', dateAt(2))]} />)

        expect(screen.getByText('События здесь')).toBeInTheDocument()
        // Тип-метка («Покатушка») и название («Вечерний заезд») — разные элементы.
        const button = screen.getByRole('button', { name: /Вечерний заезд/ })
        expect(button).toHaveTextContent('Покатушка')
        expect(button).toHaveTextContent('Вечерний заезд')
    })

    it('показывает ближайшую дату для будущего события', () => {
        render(<PointEventsBlock events={[blockEvent('e1', 'training', 'Обучение', dateAt(2))]} />)

        expect(screen.getByText(/Ближайшее:/)).toBeInTheDocument()
    })

    it('помечает идущее событие как «Сейчас» с подписью «Следующее»', () => {
        const startedAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
        render(<PointEventsBlock events={[blockEvent('e1', 'event', 'Встреча', startedAgo, 90)]} />)

        expect(screen.getByText('Сейчас')).toBeInTheDocument()
    })

    it('вызывает onOpenEvents при клике по событию', async () => {
        const onOpenEvents = vi.fn()
        render(
            <PointEventsBlock
                events={[blockEvent('e1', 'group_ride', 'Покатушка', dateAt(2))]}
                onOpenEvents={onOpenEvents}
            />,
        )

        await user.click(screen.getByRole('button', { name: /Покатушка/ }))

        expect(onOpenEvents).toHaveBeenCalledTimes(1)
    })

    it('рендерит несколько событий', () => {
        render(
            <PointEventsBlock
                events={[
                    blockEvent('e1', 'group_ride', 'Покатушка', dateAt(2)),
                    blockEvent('e2', 'training', 'Обучение', dateAt(5)),
                ]}
            />,
        )

        expect(screen.getAllByRole('button')).toHaveLength(2)
    })
})
