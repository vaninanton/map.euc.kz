import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareBlock } from './ShareBlock'
import type { Feature } from '@/types/geojson'

vi.mock('@/utils/shareLinks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/utils/shareLinks')>()
    return {
        ...actual,
        copyOrShare: vi.fn().mockResolvedValue(true),
    }
})

import { copyOrShare } from '@/utils/shareLinks'
const mockCopyOrShare = vi.mocked(copyOrShare)

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
        geometry: { type: 'LineString', coordinates: [[76.9, 43.2], [76.95, 43.25]] },
        properties: { id: 'r1', type: 'route', name: 'Маршрут' },
    }
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('ShareBlock', () => {
    it('рендерит кнопку "Копировать ссылку"', () => {
        render(<ShareBlock feature={makePointFeature()} />)
        expect(screen.getByTitle(/копировать ссылку/i)).toBeInTheDocument()
    })

    it('показывает тост после копирования', async () => {
        render(<ShareBlock feature={makePointFeature()} />)
        await userEvent.click(screen.getByTitle(/копировать ссылку/i))
        expect(await screen.findByText(/ссылка скопирована/i)).toBeInTheDocument()
    })

    it('вызывает copyOrShare при клике', async () => {
        render(<ShareBlock feature={makePointFeature()} />)
        await userEvent.click(screen.getByTitle(/копировать ссылку/i))
        expect(mockCopyOrShare).toHaveBeenCalledOnce()
    })

    it('вызывает onCopied callback после успешного копирования', async () => {
        const onCopied = vi.fn()
        render(<ShareBlock feature={makePointFeature()} onCopied={onCopied} />)
        await userEvent.click(screen.getByTitle(/копировать ссылку/i))
        await waitFor(() => { expect(onCopied).toHaveBeenCalledOnce() })
    })

    it('не показывает тост если copyOrShare вернул false', async () => {
        mockCopyOrShare.mockResolvedValueOnce(false)
        render(<ShareBlock feature={makePointFeature()} />)
        await userEvent.click(screen.getByTitle(/копировать ссылку/i))
        expect(screen.queryByText(/ссылка скопирована/i)).not.toBeInTheDocument()
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
            geometry: { type: 'LineString', coordinates: [[76.9, 43.2], [76.95, 43.25]] },
            properties: { id: 'bl1', type: 'bikeLane', name: 'Велодорожка' },
        }
        render(<ShareBlock feature={bikeLane} />)
        expect(screen.queryByTitle(/яндекс/i)).not.toBeInTheDocument()
    })
})
