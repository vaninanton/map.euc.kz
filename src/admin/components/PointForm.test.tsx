import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PointForm, type PointFormValue } from './PointForm'

vi.mock('@/admin/components/AdminPointLocationMap', () => ({
    AdminPointLocationMap: () => <div data-testid="map-stub" />,
}))

vi.mock('@/admin/lib/adminApi', () => ({
    improveWithAi: vi.fn(),
}))

import { improveWithAi } from '@/admin/lib/adminApi'

const INITIAL: PointFormValue = {
    type: 'point',
    title: 'первомайские пруды',
    description: 'старое описание',
    coordinates: [76.878922, 43.278067],
    flag_is_meeting: true,
    flag_has_socket: false,
    flag_erlan: false,
    flag_disabled: false,
}

describe('PointForm + ИИ-помощник', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // jsdom не реализует scrollIntoView (используется после «Применить»)
        Element.prototype.scrollIntoView = vi.fn()
        vi.mocked(improveWithAi).mockResolvedValue({
            title: 'Первомайские пруды',
            description: 'Новое описание от ИИ.',
            pois: [],
        })
    })

    it('«Применить» подставляет предложение ИИ в поля названия и описания', async () => {
        render(<PointForm initial={INITIAL} submitLabel="Сохранить" onSubmit={vi.fn()} />)

        const titleInput = screen.getByDisplayValue('первомайские пруды')
        const descriptionInput = screen.getByDisplayValue('старое описание')

        fireEvent.click(screen.getByRole('button', { name: 'Улучшить с ИИ' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Применить' }))

        expect((titleInput as HTMLInputElement).value).toBe('Первомайские пруды')
        expect((descriptionInput as HTMLTextAreaElement).value).toBe('Новое описание от ИИ.')
    })
})
