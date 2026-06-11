import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PopupContent } from './PopupContent'
import type { Feature } from '@/types/geojson'

vi.mock('typograf', () => ({
    default: class {
        execute(text: string) { return text }
    },
}))

vi.mock('@/components/ShareBlock', () => ({
    ShareBlock: () => <div data-testid="share-block" />,
}))

function makePoint(overrides: Record<string, unknown> = {}): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        properties: {
            id: 'p1',
            type: 'point',
            name: 'Парк',
            description: null,
            isMeeting: false,
            hasSocket: false,
            isErlan: false,
            photos: [],
            ...overrides,
        },
    }
}

function makeSocket(overrides: Record<string, unknown> = {}): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        properties: { id: 's1', type: 'socket', name: 'Розетка', photos: [], ...overrides },
    }
}

function makeRoute(): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[76.9, 43.2], [76.95, 43.25]] },
        properties: { id: 'r1', type: 'route', name: 'Маршрут', distance: 5.2 },
    }
}

function makeTelegramUser(): Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [76.9, 43.2] },
        properties: {
            id: 'tg1',
            type: 'telegramUser',
            name: 'Rider',
            updatedAt: new Date(Date.now() - 30000).toISOString(),
            telegramUserId: 1,
        },
    }
}

describe('PopupContent', () => {
    it('показывает название фичи', () => {
        render(<PopupContent feature={makePoint({ name: 'Панфилова' })} />)
        expect(screen.getByText('Панфилова')).toBeInTheDocument()
    })

    it('показывает "Без названия" если name отсутствует', () => {
        render(<PopupContent feature={makePoint({ name: undefined })} />)
        expect(screen.getByText('Без названия')).toBeInTheDocument()
    })

    it('показывает тип объекта', () => {
        render(<PopupContent feature={makePoint()} />)
        expect(screen.getByText(/точка/i)).toBeInTheDocument()
    })

    it('показывает бейдж "Место встречи" для meeting-точки', () => {
        render(<PopupContent feature={makePoint({ isMeeting: true })} />)
        expect(screen.getByText(/место встречи/i)).toBeInTheDocument()
    })

    it('не показывает бейдж "Место встречи" для обычной точки', () => {
        render(<PopupContent feature={makePoint({ isMeeting: false })} />)
        expect(screen.queryByText(/место встречи/i)).not.toBeInTheDocument()
    })

    it('показывает "Можно зарядиться" для точки с розеткой', () => {
        render(<PopupContent feature={makePoint({ hasSocket: true })} />)
        expect(screen.getByText(/зарядиться/i)).toBeInTheDocument()
    })

    it('показывает "Ерландия" для isErlan', () => {
        render(<PopupContent feature={makePoint({ isErlan: true })} />)
        expect(screen.getByText(/ерланд/i)).toBeInTheDocument()
    })

    it('показывает описание если задано', () => {
        render(<PopupContent feature={makePoint({ description: 'Тестовое описание' })} />)
        expect(screen.getByText('Тестовое описание')).toBeInTheDocument()
    })

    it('показывает статистику для маршрута', () => {
        render(<PopupContent feature={makeRoute()} />)
        expect(screen.getByText(/5\.2 км/i)).toBeInTheDocument()
    })

    it('показывает время последней геопозиции для telegramUser', () => {
        render(<PopupContent feature={makeTelegramUser()} />)
        expect(screen.getByText(/последняя гео/i)).toBeInTheDocument()
    })

    it('показывает аватар telegramUser если avatarUrl задан', () => {
        const feature = makeTelegramUser()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- мутируем тестовые данные напрямую
        ;(feature.properties as any).avatarUrl = 'https://example.com/avatar.jpg'
        render(<PopupContent feature={feature} />)
        expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('показывает фотогалерею если есть фото', () => {
        const photos = [
            { id: 'ph1', url: 'https://example.com/1.jpg', alt: 'Фото 1' },
            { id: 'ph2', url: 'https://example.com/2.jpg', alt: 'Фото 2' },
        ]
        render(<PopupContent feature={makePoint({ photos })} />)
        expect(screen.getAllByRole('img')).toHaveLength(2)
    })

    it('клик на фото открывает лайтбокс', async () => {
        const photos = [{ id: 'ph1', url: 'https://example.com/1.jpg', alt: 'Фото 1' }]
        render(<PopupContent feature={makePoint({ photos })} />)
        await userEvent.click(screen.getAllByRole('button')[0])
        expect(screen.getByRole('dialog', { name: /просмотр фотографии/i })).toBeInTheDocument()
    })

    it('лайтбокс закрывается по кнопке ×', async () => {
        const photos = [{ id: 'ph1', url: 'https://example.com/1.jpg', alt: 'Фото 1' }]
        render(<PopupContent feature={makePoint({ photos })} />)
        await userEvent.click(screen.getAllByRole('button')[0])
        await userEvent.click(screen.getByRole('button', { name: /закрыть просмотр/i }))
        expect(screen.queryByRole('dialog', { name: /просмотр фотографии/i })).not.toBeInTheDocument()
    })

    it('лайтбокс закрывается по клавише Escape', async () => {
        const photos = [{ id: 'ph1', url: 'https://example.com/1.jpg', alt: 'Фото 1' }]
        render(<PopupContent feature={makePoint({ photos })} />)
        await userEvent.click(screen.getAllByRole('button')[0])
        await userEvent.keyboard('{Escape}')
        expect(screen.queryByRole('dialog', { name: /просмотр фотографии/i })).not.toBeInTheDocument()
    })

    it('навигация по фото стрелками в лайтбоксе', async () => {
        const photos = [
            { id: 'ph1', url: 'https://example.com/1.jpg', alt: 'Фото 1' },
            { id: 'ph2', url: 'https://example.com/2.jpg', alt: 'Фото 2' },
        ]
        render(<PopupContent feature={makePoint({ photos })} />)
        await userEvent.click(screen.getAllByRole('button')[0])
        await userEvent.keyboard('{ArrowRight}')
        // Лайтбокс всё ещё открыт, показывается второе фото
        expect(screen.getByRole('dialog', { name: /просмотр фотографии/i })).toBeInTheDocument()
    })

    it('рендерит ShareBlock', () => {
        render(<PopupContent feature={makeSocket()} />)
        expect(screen.getByTestId('share-block')).toBeInTheDocument()
    })
})
