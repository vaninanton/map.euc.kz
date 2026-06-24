import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
    it('рендерит содержимое', () => {
        render(<Badge color="socket">Розетка</Badge>)
        expect(screen.getByText('Розетка')).toBeInTheDocument()
    })

    it('применяет классы выбранного цвета', () => {
        render(<Badge color="erlan">Ерландия</Badge>)
        expect(screen.getByText('Ерландия')).toHaveClass('text-purple-700')
    })
})
