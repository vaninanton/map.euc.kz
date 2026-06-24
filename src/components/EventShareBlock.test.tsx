import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventShareBlock } from './EventShareBlock'
import { makeEvent } from '@/test/eventFactories'

const user = userEvent.setup()

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('EventShareBlock', () => {
    it('кнопка Telegram ведёт на t.me/share с deep-link и заголовком события', () => {
        render(<EventShareBlock event={makeEvent({ id: 'e9', title: 'Вечерняя покатушка' })} />)

        const link = screen.getByRole('link', { name: 'Поделиться в Telegram' })
        const href = link.getAttribute('href') ?? ''
        expect(href).toContain('t.me/share/url')
        expect(decodeURIComponent(href)).toContain('events/e9')
        expect(decodeURIComponent(href)).toContain('Вечерняя+покатушка')
    })

    it('копирует ссылку события в буфер и показывает тост', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', { clipboard: { writeText } })

        render(<EventShareBlock event={makeEvent({ id: 'e9', title: 'Вечерняя покатушка' })} />)

        await user.click(screen.getByRole('button', { name: 'Копировать ссылку' }))

        expect(writeText).toHaveBeenCalledTimes(1)
        expect(writeText.mock.calls[0][0]).toContain('/events/e9')
        await waitFor(() => {
            expect(screen.getByText('Ссылка скопирована')).toBeInTheDocument()
        })
    })
})
