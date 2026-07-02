import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AiAssistPanel } from './AiAssistPanel'
import type { AiAssistEntity } from '@/admin/utils/aiAssistPrompt'

vi.mock('@/utils/shareLinks', () => ({
    copyToClipboard: vi.fn(),
}))

vi.mock('@/admin/lib/adminApi', () => ({
    improveWithAi: vi.fn(),
}))

import { improveWithAi, type AiSuggestion } from '@/admin/lib/adminApi'
import { copyToClipboard } from '@/utils/shareLinks'

function makeEntity(over: Partial<Extract<AiAssistEntity, { kind: 'point' }>> = {}): AiAssistEntity {
    return {
        kind: 'point',
        pointType: 'point',
        title: 'Роща Баума',
        description: 'Тенистая роща.',
        coordinates: [76.945, 43.238],
        flagIsMeeting: true,
        flagHasSocket: false,
        flagErlan: false,
        ...over,
    }
}

describe('AiAssistPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(copyToClipboard).mockResolvedValue(true)
        vi.mocked(improveWithAi).mockResolvedValue({
            title: 'Улучшенное название',
            description: 'Улучшенное описание.',
            pois: [],
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('показывает промпт с текущим названием в readonly-textarea', () => {
        render(<AiAssistPanel entity={makeEntity()} />)
        const textarea = screen.getByRole('textbox')
        expect(textarea).toHaveProperty('readOnly', true)
        expect((textarea as HTMLTextAreaElement).value).toContain('Текущее название: «Роща Баума»')
    })

    it('обновляет промпт при изменении entity (live-значения)', () => {
        const { rerender } = render(<AiAssistPanel entity={makeEntity()} />)
        rerender(<AiAssistPanel entity={makeEntity({ title: 'Новое название' })} />)
        const textarea = screen.getByRole('textbox')
        expect((textarea as HTMLTextAreaElement).value).toContain('Текущее название: «Новое название»')
    })

    it('копирует промпт и показывает «Скопировано» на 2,5 секунды', async () => {
        vi.useFakeTimers()
        render(<AiAssistPanel entity={makeEntity()} />)
        const button = screen.getByRole('button', { name: 'Скопировать промпт' })
        expect(button.getAttribute('type')).toBe('button')

        fireEvent.click(button)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(vi.mocked(copyToClipboard)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(copyToClipboard).mock.calls[0][0]).toContain('Текущее название: «Роща Баума»')
        expect(screen.getByRole('button', { name: 'Скопировано' })).toBeDefined()

        act(() => {
            vi.advanceTimersByTime(2500)
        })
        expect(screen.getByRole('button', { name: 'Скопировать промпт' })).toBeDefined()
    })

    it('не показывает «Скопировано», если копирование не удалось', async () => {
        vi.mocked(copyToClipboard).mockResolvedValue(false)
        render(<AiAssistPanel entity={makeEntity()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Скопировать промпт' }))
        await waitFor(() => {
            expect(vi.mocked(copyToClipboard)).toHaveBeenCalledTimes(1)
        })
        expect(screen.queryByRole('button', { name: 'Скопировано' })).toBeNull()
    })

    it('без onApply кнопки «Улучшить с ИИ» нет', () => {
        render(<AiAssistPanel entity={makeEntity()} />)
        expect(screen.queryByRole('button', { name: 'Улучшить с ИИ' })).toBeNull()
    })

    it('«Улучшить с ИИ» → предложение → «Применить» вызывает onApply и скрывает блок', async () => {
        const onApply = vi.fn()
        render(<AiAssistPanel entity={makeEntity()} onApply={onApply} />)

        fireEvent.click(screen.getByRole('button', { name: 'Улучшить с ИИ' }))
        expect(await screen.findByText('Улучшенное название')).toBeDefined()
        expect(vi.mocked(improveWithAi)).toHaveBeenCalledWith(makeEntity(), true)

        fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
        expect(onApply).toHaveBeenCalledWith({
            title: 'Улучшенное название',
            description: 'Улучшенное описание.',
            pois: [],
        })
        expect(screen.queryByText('Улучшенное название')).toBeNull()
        expect(screen.getByText('Подставлено в поля формы — проверьте и нажмите «Сохранить».')).toBeDefined()
    })

    it('чекбокс «Искать в интернете» выключен → промпт без POI и improveWithAi с webSearch=false', async () => {
        render(<AiAssistPanel entity={makeEntity()} onApply={vi.fn()} />)

        const checkbox = screen.getByRole('checkbox', { name: /Искать в интернете/ })
        expect(checkbox).toHaveProperty('checked', true)
        const textarea = screen.getByRole('textbox')
        expect((textarea as HTMLTextAreaElement).value).toContain('точки интереса')

        fireEvent.click(checkbox)
        expect((textarea as HTMLTextAreaElement).value).not.toContain('точки интереса')
        expect((textarea as HTMLTextAreaElement).value).toContain('{"title": "...", "description": "..."}')

        fireEvent.click(screen.getByRole('button', { name: 'Улучшить с ИИ' }))
        await screen.findByText('Улучшенное название')
        expect(vi.mocked(improveWithAi)).toHaveBeenCalledWith(makeEntity(), false)
    })

    it('показывает точки интереса из предложения', async () => {
        vi.mocked(improveWithAi).mockResolvedValue({
            title: 'Улучшенное название',
            description: 'Улучшенное описание.',
            pois: ['Кафе «Роща» — кофе и розетки', 'Родник — питьевая вода'],
        })
        render(<AiAssistPanel entity={makeEntity()} onApply={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Улучшить с ИИ' }))
        expect(await screen.findByText('Точки интереса рядом')).toBeDefined()
        expect(screen.getByText('Кафе «Роща» — кофе и розетки')).toBeDefined()
        expect(screen.getByText('Родник — питьевая вода')).toBeDefined()
    })

    it('«Отклонить» скрывает предложение без onApply-вызова', async () => {
        const onApply = vi.fn()
        render(<AiAssistPanel entity={makeEntity()} onApply={onApply} />)

        fireEvent.click(screen.getByRole('button', { name: 'Улучшить с ИИ' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Отклонить' }))

        expect(onApply).not.toHaveBeenCalled()
        expect(screen.queryByText('Улучшенное название')).toBeNull()
    })

    it('ошибка improveWithAi показывается, кнопка снова активна', async () => {
        vi.mocked(improveWithAi).mockRejectedValue(new Error('openai_failed'))
        render(<AiAssistPanel entity={makeEntity()} onApply={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Улучшить с ИИ' }))
        expect(await screen.findByText('openai_failed')).toBeDefined()
        expect(screen.getByRole('button', { name: 'Улучшить с ИИ' })).toHaveProperty('disabled', false)
    })

    it('во время запроса кнопка показывает «Улучшаю…» и заблокирована', async () => {
        let resolvePromise: (v: AiSuggestion) => void = () => undefined
        vi.mocked(improveWithAi).mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvePromise = resolve
                }),
        )
        render(<AiAssistPanel entity={makeEntity()} onApply={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Улучшить с ИИ' }))
        expect(screen.getByRole('button', { name: 'Улучшаю…' })).toHaveProperty('disabled', true)

        await act(async () => {
            resolvePromise({ title: 'Готово название', description: 'Готово описание.', pois: [] })
            await Promise.resolve()
        })
        expect(screen.getByText('Готово название')).toBeDefined()
    })
})
