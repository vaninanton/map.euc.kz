import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterChips } from './FilterChips'

const user = userEvent.setup()

const OPTIONS = [
    ['all', 'Все'],
    ['point', 'Точки'],
] as const

describe('FilterChips', () => {
    it('рендерит опции и заголовок', () => {
        render(<FilterChips label="Тип" options={OPTIONS} value="all" onChange={vi.fn()} activeClass="active" />)
        expect(screen.getByText('Тип')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Все' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Точки' })).toBeInTheDocument()
    })

    it('зовёт onChange с выбранным значением', async () => {
        const onChange = vi.fn()
        render(<FilterChips options={OPTIONS} value="all" onChange={onChange} activeClass="active" />)
        await user.click(screen.getByRole('button', { name: 'Точки' }))
        expect(onChange).toHaveBeenCalledWith('point')
    })

    it('применяет activeClass к выбранной опции', () => {
        render(<FilterChips options={OPTIONS} value="point" onChange={vi.fn()} activeClass="active-chip" />)
        expect(screen.getByRole('button', { name: 'Точки' })).toHaveClass('active-chip')
        expect(screen.getByRole('button', { name: 'Все' })).not.toHaveClass('active-chip')
    })
})
