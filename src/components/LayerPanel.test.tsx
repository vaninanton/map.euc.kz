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

const DEFAULT_PROPS = {
    visibility: DEFAULT_VISIBILITY,
    onToggle: vi.fn(),
    onCollapse: vi.fn(),
    baseStyle: 'streets' as const,
    onToggleBaseStyle: vi.fn(),
}

describe('LayerPanel', () => {
    it('рендерит все 5 слоёв', () => {
        render(<LayerPanel {...DEFAULT_PROPS} />)
        expect(screen.getByText('Точки')).toBeInTheDocument()
        expect(screen.getByText('Розетки')).toBeInTheDocument()
        expect(screen.getByText('Маршруты')).toBeInTheDocument()
        expect(screen.getByText('Велодорожки')).toBeInTheDocument()
        expect(screen.getByText('Геопозиции')).toBeInTheDocument()
    })

    it('чекбоксы отражают текущую видимость', () => {
        const visibility = { ...DEFAULT_VISIBILITY, routes: false }
        render(<LayerPanel {...DEFAULT_PROPS} visibility={visibility} />)
        // Порядок LAYER_ORDER: ['points', 'routes', 'bikeLanes', 'sockets', 'telegramUsers']
        const allCheckboxes = screen.getAllByRole('checkbox')
        expect(allCheckboxes[1]).not.toBeChecked() // routes — второй в LAYER_ORDER
    })

    it('вызывает onToggle с правильным ключом при клике на чекбокс', async () => {
        const onToggle = vi.fn()
        render(<LayerPanel {...DEFAULT_PROPS} onToggle={onToggle} />)
        // Клик по первому чекбоксу (points)
        await userEvent.click(screen.getAllByRole('checkbox')[0])
        expect(onToggle).toHaveBeenCalledWith('points')
    })

    it('кнопка закрытия вызывает onCollapse', async () => {
        const onCollapse = vi.fn()
        render(<LayerPanel {...DEFAULT_PROPS} onCollapse={onCollapse} />)
        await userEvent.click(screen.getByRole('button', { name: /закрыть панель/i }))
        expect(onCollapse).toHaveBeenCalledOnce()
    })

    it('панель имеет role=group с подписью', () => {
        render(<LayerPanel {...DEFAULT_PROPS} />)
        expect(screen.getByRole('group', { name: /слои карты/i })).toBeInTheDocument()
    })

    it('все слои включены: чекбоксы слоёв checked, спутник выключен', () => {
        render(<LayerPanel {...DEFAULT_PROPS} />)
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes).toHaveLength(6) // 5 слоёв + спутник
        for (const cb of checkboxes.slice(0, 5)) expect(cb).toBeChecked()
        expect(checkboxes[5]).not.toBeChecked() // спутник выключен (streets)
    })

    it('все слои выключены: все чекбоксы слоёв не checked', () => {
        const visibility: LayerVisibility = {
            points: false,
            sockets: false,
            routes: false,
            bikeLanes: false,
            telegramUsers: false,
        }
        render(<LayerPanel {...DEFAULT_PROPS} visibility={visibility} />)
        const checkboxes = screen.getAllByRole('checkbox')
        for (const cb of checkboxes.slice(0, 5)) expect(cb).not.toBeChecked()
    })

    it('чекбокс спутника checked когда baseStyle=satellite', () => {
        render(<LayerPanel {...DEFAULT_PROPS} baseStyle="satellite" />)
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes[5]).toBeChecked()
    })

    it('клик по чекбоксу спутника вызывает onToggleBaseStyle', async () => {
        const onToggleBaseStyle = vi.fn()
        render(<LayerPanel {...DEFAULT_PROPS} onToggleBaseStyle={onToggleBaseStyle} />)
        await userEvent.click(screen.getByLabelText('Спутник'))
        expect(onToggleBaseStyle).toHaveBeenCalledOnce()
    })
})
