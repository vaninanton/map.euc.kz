import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeatureSidebar } from './FeatureSidebar'
import type { Feature } from '@/types/geojson'

vi.mock('@/components/PopupContent', () => ({
    PopupContent: ({ feature }: { feature: Feature }) => (
        <div data-testid="popup-content">{feature.properties.id}</div>
    ),
}))

function makeFeature(id = 'p1'): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        properties: { id, type: 'point', name: 'Тест' },
    }
}

describe('FeatureSidebar', () => {
    it('рендерит PopupContent с переданной фичей', () => {
        render(<FeatureSidebar feature={makeFeature('p1')} onClose={vi.fn()} />)
        expect(screen.getByTestId('popup-content')).toHaveTextContent('p1')
    })

    it('рендерит заголовок "Подробности"', () => {
        render(<FeatureSidebar feature={makeFeature()} onClose={vi.fn()} />)
        expect(screen.getByText('Подробности')).toBeInTheDocument()
    })

    it('кнопка закрытия вызывает onClose', async () => {
        const onClose = vi.fn()
        render(<FeatureSidebar feature={makeFeature()} onClose={onClose} />)
        await userEvent.click(screen.getByRole('button', { name: /закрыть/i }))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('имеет role=dialog с accessible-именем', () => {
        render(<FeatureSidebar feature={makeFeature()} onClose={vi.fn()} />)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
})
