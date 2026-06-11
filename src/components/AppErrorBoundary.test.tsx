import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppErrorBoundary } from './AppErrorBoundary'

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) throw new Error('Тестовая ошибка')
    return <div>Контент</div>
}

// Подавляем console.error от React error boundary в тестах
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('AppErrorBoundary', () => {
    it('рендерит дочерние элементы если ошибок нет', () => {
        render(
            <AppErrorBoundary>
                <div>Нормальный контент</div>
            </AppErrorBoundary>,
        )
        expect(screen.getByText('Нормальный контент')).toBeInTheDocument()
    })

    it('показывает fallback UI при ошибке', () => {
        render(
            <AppErrorBoundary>
                <ThrowingChild shouldThrow />
            </AppErrorBoundary>,
        )
        expect(screen.getByText('Ошибка интерфейса')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /перезагрузить/i })).toBeInTheDocument()
    })

    it('кнопка "Перезагрузить" вызывает window.location.reload', async () => {
        const reloadMock = vi.fn()
        Object.defineProperty(window, 'location', {
            value: { reload: reloadMock },
            writable: true,
            configurable: true,
        })
        render(
            <AppErrorBoundary>
                <ThrowingChild shouldThrow />
            </AppErrorBoundary>,
        )
        await userEvent.click(screen.getByRole('button', { name: /перезагрузить/i }))
        expect(reloadMock).toHaveBeenCalledOnce()
    })

    it('fallback не рендерится если ошибки нет', () => {
        render(
            <AppErrorBoundary>
                <ThrowingChild shouldThrow={false} />
            </AppErrorBoundary>,
        )
        expect(screen.queryByText('Ошибка интерфейса')).not.toBeInTheDocument()
        expect(screen.getByText('Контент')).toBeInTheDocument()
    })
})
