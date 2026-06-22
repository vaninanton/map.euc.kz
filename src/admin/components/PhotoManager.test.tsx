import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PhotoManager } from '@/admin/components/PhotoManager'
import * as adminApi from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'

vi.mock('@/admin/lib/adminApi', () => ({
    listPhotos: vi.fn(),
    uploadPhoto: vi.fn(),
    updatePhoto: vi.fn(),
    deletePhoto: vi.fn(),
}))

vi.mock('@/admin/hooks/useAdminListLoader', () => ({
    useAdminListLoader: vi.fn(),
}))

const makePhoto = (overrides: Record<string, unknown> = {}) => ({
    id: '1',
    point_id: 42,
    storage_path: '42/photo1.jpg',
    bucket_name: 'map-point-photos',
    alt_text: null,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    public_url: 'https://example.com/photo1.jpg',
    ...overrides,
})

const PHOTO_1 = makePhoto()
const PHOTO_2 = makePhoto({
    id: '2',
    storage_path: '42/photo2.jpg',
    sort_order: 1,
    public_url: 'https://example.com/photo2.jpg',
})

function setupLoader(photos: ReturnType<typeof makePhoto>[] = []) {
    const reload = vi.fn().mockResolvedValue(undefined)
    const setItems = vi.fn()
    const setError = vi.fn()
    vi.mocked(useAdminListLoader).mockReturnValue({
        items: photos,
        setItems,
        loading: false,
        error: null,
        setError,
        reload,
    })
    return { reload, setItems, setError }
}

beforeEach(() => {
    vi.clearAllMocks()
})

function getDropZone(): HTMLElement {
    const zone = screen.getByText(/перетащите фото/i).closest('div')
    if (!zone) throw new Error('drop zone not found')
    return zone
}

// ─── Drag & drop ────────────────────────────────────────────────────────────

describe('drag & drop', () => {
    it('подсвечивает зону при dragenter', () => {
        setupLoader()
        render(<PhotoManager pointId={42} />)
        const zone = getDropZone()

        fireEvent.dragEnter(zone)
        expect(zone.className).toContain('border-blue-400')
        expect(screen.getByText('Отпустите для загрузки')).toBeTruthy()
    })

    it('убирает подсветку при dragleave', () => {
        setupLoader()
        render(<PhotoManager pointId={42} />)
        const zone = getDropZone()

        fireEvent.dragEnter(zone)
        fireEvent.dragLeave(zone)
        expect(zone.className).not.toContain('border-blue-400')
    })

    it('загружает jpeg-файл при drop', async () => {
        setupLoader()
        vi.mocked(adminApi.uploadPhoto).mockResolvedValue(makePhoto())
        render(<PhotoManager pointId={42} />)
        const zone = getDropZone()

        const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
        fireEvent.drop(zone, { dataTransfer: { files: [file] } })

        await waitFor(() => {
            expect(adminApi.uploadPhoto).toHaveBeenCalledWith(42, file, null, 0)
        })
    })

    it('загружает webp-файл при drop', async () => {
        setupLoader()
        vi.mocked(adminApi.uploadPhoto).mockResolvedValue(makePhoto())
        render(<PhotoManager pointId={42} />)
        const zone = getDropZone()

        const file = new File(['img'], 'photo.webp', { type: 'image/webp' })
        fireEvent.drop(zone, { dataTransfer: { files: [file] } })

        await waitFor(() => {
            expect(adminApi.uploadPhoto).toHaveBeenCalledWith(42, file, null, 0)
        })
    })

    it('игнорирует pdf при drop', async () => {
        setupLoader()
        render(<PhotoManager pointId={42} />)
        const zone = getDropZone()

        // jsdom не различает типы в dataTransfer, поэтому тестируем через filterImageFiles напрямую:
        // подменяем файл с неизображением, убеждаемся что uploadPhoto не вызван до дропа
        const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
        // Файл дропаем, но он отфильтруется в filterImageFiles
        Object.defineProperty(file, 'type', { value: 'application/pdf' })
        fireEvent.drop(zone, { dataTransfer: { files: [file] } })

        // waitFor с небольшим timeout чтобы убедиться что uploadPhoto не вызвался
        await new Promise((r) => setTimeout(r, 50))
        expect(adminApi.uploadPhoto).not.toHaveBeenCalled()
    })
})

// ─── Paste ──────────────────────────────────────────────────────────────────

describe('paste из буфера', () => {
    it('загружает png из буфера обмена', async () => {
        setupLoader()
        vi.mocked(adminApi.uploadPhoto).mockResolvedValue(makePhoto())
        render(<PhotoManager pointId={42} />)

        const file = new File(['img'], 'paste.png', { type: 'image/png' })
        const item = { kind: 'file', type: 'image/png', getAsFile: () => file }
        fireEvent.paste(document, { clipboardData: { items: [item] } })

        await waitFor(() => {
            expect(adminApi.uploadPhoto).toHaveBeenCalledWith(42, file, null, 0)
        })
    })

    it('игнорирует текст из буфера', async () => {
        setupLoader()
        render(<PhotoManager pointId={42} />)

        const item = { kind: 'string', type: 'text/plain', getAsFile: () => null }
        fireEvent.paste(document, { clipboardData: { items: [item] } })

        await new Promise((r) => setTimeout(r, 50))
        expect(adminApi.uploadPhoto).not.toHaveBeenCalled()
    })

    it('игнорирует pdf из буфера', async () => {
        setupLoader()
        render(<PhotoManager pointId={42} />)

        const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
        const item = { kind: 'file', type: 'application/pdf', getAsFile: () => file }
        fireEvent.paste(document, { clipboardData: { items: [item] } })

        await new Promise((r) => setTimeout(r, 50))
        expect(adminApi.uploadPhoto).not.toHaveBeenCalled()
    })
})

// ─── Лайтбокс ───────────────────────────────────────────────────────────────

describe('лайтбокс', () => {
    it('открывается при клике на превью', () => {
        setupLoader([PHOTO_1, PHOTO_2])
        render(<PhotoManager pointId={42} />)

        fireEvent.click(screen.getAllByRole('button', { name: 'Открыть фото' })[0])

        // лайтбокс-изображение имеет класс object-contain, превью — object-cover
        const lightboxImg = screen.getAllByAltText('').find((el) => el.className.includes('object-contain'))
        expect(lightboxImg).toHaveAttribute('src', PHOTO_1.public_url)
        expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    it('навигация вперёд по кнопке ›', () => {
        setupLoader([PHOTO_1, PHOTO_2])
        render(<PhotoManager pointId={42} />)
        fireEvent.click(screen.getAllByRole('button', { name: 'Открыть фото' })[0])

        fireEvent.click(screen.getByRole('button', { name: 'Следующее фото' }))

        expect(screen.getByText('2 / 2')).toBeTruthy()
    })

    it('навигация назад по кнопке ‹', () => {
        setupLoader([PHOTO_1, PHOTO_2])
        render(<PhotoManager pointId={42} />)
        fireEvent.click(screen.getAllByRole('button', { name: 'Открыть фото' })[1])

        fireEvent.click(screen.getByRole('button', { name: 'Предыдущее фото' }))

        expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    it('навигация клавишами ArrowRight / ArrowLeft', () => {
        setupLoader([PHOTO_1, PHOTO_2])
        render(<PhotoManager pointId={42} />)
        fireEvent.click(screen.getAllByRole('button', { name: 'Открыть фото' })[0])

        fireEvent.keyDown(document, { key: 'ArrowRight' })
        expect(screen.getByText('2 / 2')).toBeTruthy()

        fireEvent.keyDown(document, { key: 'ArrowLeft' })
        expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    it('закрывается по Escape', () => {
        setupLoader([PHOTO_1, PHOTO_2])
        render(<PhotoManager pointId={42} />)
        fireEvent.click(screen.getAllByRole('button', { name: 'Открыть фото' })[0])
        expect(screen.getByText('1 / 2')).toBeTruthy()

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.queryByText('1 / 2')).toBeNull()
    })

    it('закрывается по кнопке ×', () => {
        setupLoader([PHOTO_1, PHOTO_2])
        render(<PhotoManager pointId={42} />)
        fireEvent.click(screen.getAllByRole('button', { name: 'Открыть фото' })[0])

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))

        expect(screen.queryByText('1 / 2')).toBeNull()
    })

    it('счётчик не отображается при одном фото', () => {
        setupLoader([PHOTO_1])
        render(<PhotoManager pointId={42} />)
        fireEvent.click(screen.getByRole('button', { name: 'Открыть фото' }))

        expect(screen.queryByText(/\//)).toBeNull()
        expect(screen.queryByRole('button', { name: 'Следующее фото' })).toBeNull()
    })

    it('навигация зациклена: с последнего переходит на первое', () => {
        setupLoader([PHOTO_1, PHOTO_2])
        render(<PhotoManager pointId={42} />)
        fireEvent.click(screen.getAllByRole('button', { name: 'Открыть фото' })[1])
        expect(screen.getByText('2 / 2')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Следующее фото' }))

        expect(screen.getByText('1 / 2')).toBeTruthy()
    })
})
