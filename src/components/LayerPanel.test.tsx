import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayerPanel } from './LayerPanel'
import type { LayerVisibility } from '@/constants/layerVisibility'

const DEFAULT_VISIBILITY: LayerVisibility = {
    points: true,
    sockets: true,
    routes: true,
    bikeLanes: true,
    telegramUsers: true,
}

describe('LayerPanel', () => {
    it('рендерит все 5 слоёв', () => {
        render(<LayerPanel visibility={DEFAULT_VISIBILITY} onToggle={vi.fn()} onCollapse={vi.fn()} />)
        expect(screen.getByText('Точки')).toBeInTheDocument()
        expect(screen.getByText('Розетки')).toBeInTheDocument()
        expect(screen.getByText('Маршруты')).toBeInTheDocument()
        expect(screen.getByText('Велодорожки')).toBeInTheDocument()
        expect(screen.getByText('Геопозиции')).toBeInTheDocument()
    })

    it('чекбоксы отражают текущую видимость', () => {
        const visibility = { ...DEFAULT_VISIBILITY, routes: false }
        render(<LayerPanel visibility={visibility} onToggle={vi.fn()} onCollapse={vi.fn()} />)
        // Порядок LAYER_ORDER: ['points', 'routes', 'bikeLanes', 'sockets', 'telegramUsers']
        const allCheckboxes = screen.getAllByRole('checkbox')
        expect(allCheckboxes[1]).not.toBeChecked() // routes — второй в LAYER_ORDER
    })

    it('вызывает onToggle с правильным ключом при клике на чекбокс', async () => {
        const onToggle = vi.fn()
        render(<LayerPanel visibility={DEFAULT_VISIBILITY} onToggle={onToggle} onCollapse={vi.fn()} />)
        // Клик по первому чекбоксу (points)
        await userEvent.click(screen.getAllByRole('checkbox')[0])
        expect(onToggle).toHaveBeenCalledWith('points')
    })

    it('кнопка закрытия вызывает onCollapse', async () => {
        const onCollapse = vi.fn()
        render(<LayerPanel visibility={DEFAULT_VISIBILITY} onToggle={vi.fn()} onCollapse={onCollapse} />)
        await userEvent.click(screen.getByRole('button', { name: /закрыть панель/i }))
        expect(onCollapse).toHaveBeenCalledOnce()
    })

    it('панель имеет role=group с подписью', () => {
        render(<LayerPanel visibility={DEFAULT_VISIBILITY} onToggle={vi.fn()} onCollapse={vi.fn()} />)
        expect(screen.getByRole('group', { name: /слои карты/i })).toBeInTheDocument()
    })

    it('все слои включены: все чекбоксы checked', () => {
        render(<LayerPanel visibility={DEFAULT_VISIBILITY} onToggle={vi.fn()} onCollapse={vi.fn()} />)
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes).toHaveLength(5)
        for (const cb of checkboxes) expect(cb).toBeChecked()
    })

    it('все слои выключены: все чекбоксы не checked', () => {
        const visibility: LayerVisibility = { points: false, sockets: false, routes: false, bikeLanes: false, telegramUsers: false }
        render(<LayerPanel visibility={visibility} onToggle={vi.fn()} onCollapse={vi.fn()} />)
        for (const cb of screen.getAllByRole('checkbox')) expect(cb).not.toBeChecked()
    })
})
