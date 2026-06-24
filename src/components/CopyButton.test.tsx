import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton } from './CopyButton'

const user = userEvent.setup()

describe('CopyButton', () => {
    it('зовёт onClick по нажатию', async () => {
        const onClick = vi.fn()
        render(
            <CopyButton copied={false} onClick={onClick}>
                <span>icon</span>
            </CopyButton>,
        )
        await user.click(screen.getByRole('button', { name: 'Скопировать ссылку' }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('использует кастомный ariaLabel для доступного имени', () => {
        render(
            <CopyButton copied={false} onClick={vi.fn()} ariaLabel="Копировать ссылку">
                <span>icon</span>
            </CopyButton>,
        )
        expect(screen.getByRole('button', { name: 'Копировать ссылку' })).toBeInTheDocument()
    })

    it('показывает hover-подсказку (label), пока нет подтверждения', () => {
        render(
            <CopyButton copied={false} onClick={vi.fn()} label="Скопировать ссылку">
                <span>icon</span>
            </CopyButton>,
        )
        // hover-подсказка присутствует в DOM (видимость управляется group-hover)
        expect(screen.getByText('Скопировать ссылку')).toBeInTheDocument()
        expect(screen.queryByText('Скопировано')).not.toBeInTheDocument()
    })

    it('показывает подтверждение и скрывает hover-подсказку при copied=true', () => {
        render(
            <CopyButton copied onClick={vi.fn()} label="Скопировать ссылку">
                <span>icon</span>
            </CopyButton>,
        )
        expect(screen.getByText('Скопировано')).toBeInTheDocument()
        expect(screen.getByRole('status')).toBeInTheDocument()
        expect(screen.queryByText('Скопировать ссылку')).not.toBeInTheDocument()
    })

    it('поддерживает кастомный текст подтверждения', () => {
        render(
            <CopyButton copied onClick={vi.fn()} copiedLabel="Готово">
                <span>icon</span>
            </CopyButton>,
        )
        expect(screen.getByText('Готово')).toBeInTheDocument()
    })
})
