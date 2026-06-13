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
        expect(screen.getByRole('button', { name: 'Перезагрузить' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Очистить кеш и перезагрузить' })).toBeInTheDocument()
    })

    it('кнопка "Перезагрузить" вызывает window.location.reload', async () => {
        const user = userEvent.setup({ delay: null })
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
        await user.click(screen.getByRole('button', { name: 'Перезагрузить' }))
        expect(reloadMock).toHaveBeenCalledOnce()
    })

    it('кнопка "Очистить кеш и перезагрузить" вызывает resetAppCache', async () => {
        const user = userEvent.setup({ delay: null })
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
        const btn = screen.getByRole('button', { name: 'Очистить кеш и перезагрузить' })
        await user.click(btn)
        expect(reloadMock).toHaveBeenCalledOnce()
    })

    it('кнопка очистки блокируется после нажатия', async () => {
        const user = userEvent.setup({ delay: null })
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            writable: true,
            configurable: true,
        })
        render(
            <AppErrorBoundary>
                <ThrowingChild shouldThrow />
            </AppErrorBoundary>,
        )
        const btn = screen.getByRole('button', { name: 'Очистить кеш и перезагрузить' })
        await user.click(btn)
        expect(btn).toBeDisabled()
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
