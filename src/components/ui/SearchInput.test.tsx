import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchInput } from './SearchInput'

const user = userEvent.setup()

describe('SearchInput', () => {
    it('зовёт onChange при вводе', async () => {
        const onChange = vi.fn()
        render(<SearchInput value="" onChange={onChange} placeholder="Поиск точки..." />)

        await user.type(screen.getByPlaceholderText('Поиск точки...'), 'a')
        expect(onChange).toHaveBeenCalledWith('a')
    })

    it('кнопка очистки видна только при непустом значении и сбрасывает', async () => {
        const onChange = vi.fn()
        const { rerender } = render(<SearchInput value="" onChange={onChange} />)
        expect(screen.queryByRole('button', { name: 'Очистить поиск' })).not.toBeInTheDocument()

        rerender(<SearchInput value="кафе" onChange={onChange} />)
        await user.click(screen.getByRole('button', { name: 'Очистить поиск' }))
        expect(onChange).toHaveBeenCalledWith('')
    })
})
