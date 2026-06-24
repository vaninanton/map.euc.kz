import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareBlock } from './ShareBlock'
import type { Feature } from '@/types/geojson'

vi.mock('@/utils/shareLinks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/utils/shareLinks')>()
    return {
        ...actual,
        copyToClipboard: vi.fn().mockResolvedValue(true),
    }
})

import { copyToClipboard } from '@/utils/shareLinks'
const mockCopyToClipboard = vi.mocked(copyToClipboard)

function makePointFeature(overrides: Record<string, unknown> = {}): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        properties: { id: 'p1', type: 'point', name: 'Тест', isMeeting: false, ...overrides },
    }
}

function makeRouteFeature(): Feature {
    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [
                [76.9, 43.2],
                [76.95, 43.25],
            ],
        },
        properties: { id: 'r1', type: 'route', name: 'Маршрут' },
    }
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('ShareBlock', () => {
    it('рендерит кнопку "Копировать ссылку"', () => {
        render(<ShareBlock feature={makePointFeature()} />)
        expect(screen.getByRole('button', { name: 'Копировать ссылку' })).toBeInTheDocument()
    })

    it('показывает подтверждение после копирования', async () => {
        render(<ShareBlock feature={makePointFeature()} />)
        await userEvent.click(screen.getByRole('button', { name: 'Копировать ссылку' }))
        expect(await screen.findByText('Скопировано')).toBeInTheDocument()
    })

    it('вызывает copyToClipboard при клике', async () => {
        render(<ShareBlock feature={makePointFeature()} />)
        await userEvent.click(screen.getByRole('button', { name: 'Копировать ссылку' }))
        expect(mockCopyToClipboard).toHaveBeenCalledOnce()
    })

    it('вызывает onCopied callback после успешного копирования', async () => {
        const onCopied = vi.fn()
        render(<ShareBlock feature={makePointFeature()} onCopied={onCopied} />)
        await userEvent.click(screen.getByRole('button', { name: 'Копировать ссылку' }))
        await waitFor(() => {
            expect(onCopied).toHaveBeenCalledOnce()
        })
    })

    it('не показывает подтверждение если copyToClipboard вернул false', async () => {
        mockCopyToClipboard.mockResolvedValueOnce(false)
        render(<ShareBlock feature={makePointFeature()} />)
        await userEvent.click(screen.getByRole('button', { name: 'Копировать ссылку' }))
        expect(screen.queryByText('Скопировано')).not.toBeInTheDocument()
    })

    it('для meeting-точки показывает ссылку на Telegram', () => {
        render(<ShareBlock feature={makePointFeature({ isMeeting: true })} />)
        expect(screen.getByTitle(/telegram/i)).toBeInTheDocument()
    })

    it('для обычной точки нет ссылки на Telegram', () => {
        render(<ShareBlock feature={makePointFeature({ isMeeting: false })} />)
        expect(screen.queryByTitle(/telegram/i)).not.toBeInTheDocument()
    })

    it('для маршрута показывает ссылки Яндекс, 2GIS, OpenRoute, Guru', () => {
        render(<ShareBlock feature={makeRouteFeature()} />)
        expect(screen.getByTitle(/яндекс/i)).toBeInTheDocument()
        expect(screen.getByTitle('2GIS')).toBeInTheDocument()
        expect(screen.getByTitle(/openroute/i)).toBeInTheDocument()
    })

    it('для bikeLane не показывает ссылки на карты', () => {
        const bikeLane: Feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [76.9, 43.2],
                    [76.95, 43.25],
                ],
            },
            properties: { id: 'bl1', type: 'bikeLane', name: 'Велодорожка' },
        }
        render(<ShareBlock feature={bikeLane} />)
        expect(screen.queryByTitle(/яндекс/i)).not.toBeInTheDocument()
    })
})
