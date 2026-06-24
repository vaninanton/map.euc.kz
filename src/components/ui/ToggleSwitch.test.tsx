import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleSwitch } from './ToggleSwitch'

const user = userEvent.setup()

describe('ToggleSwitch', () => {
    it('отражает checked и зовёт onChange с новым значением', async () => {
        const onChange = vi.fn()
        render(<ToggleSwitch checked={false} onChange={onChange} label="Метка" accentColor="#3b82f6" />)

        const checkbox = screen.getByRole('checkbox')
        expect(checkbox).not.toBeChecked()
        await user.click(checkbox)
        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('использует ariaLabel, когда подписи нет', () => {
        render(<ToggleSwitch checked onChange={vi.fn()} ariaLabel="Спутник" accentColor="#3b82f6" />)
        expect(screen.getByRole('checkbox', { name: 'Спутник' })).toBeChecked()
    })

    it('применяет inline-цвет включённого трека', () => {
        const { container } = render(<ToggleSwitch checked onChange={vi.fn()} accentColor="#ff0000" />)
        const track = container.querySelector('span[style]')
        expect(track).toHaveStyle({ backgroundColor: '#ff0000' })
    })
})
