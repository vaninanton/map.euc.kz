import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PHOTOS_BUCKET } from '@/admin/lib/adminApi/constants'

const upload = vi.fn()
const remove = vi.fn()
const getPublicUrl = vi.fn()
const single = vi.fn()
const select = vi.fn(() => ({ single }))
const insert = vi.fn(() => ({ select }))
const fromTable = vi.fn(() => ({ insert }))
const storageFrom = vi.fn(() => ({ upload, remove, getPublicUrl }))

vi.mock('@/lib/supabase', () => ({
    requireSupabase: () => ({
        from: fromTable,
        storage: { from: storageFrom },
    }),
}))

describe('adminApi photos', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
        upload.mockResolvedValue({ error: null })
        remove.mockResolvedValue({ error: null })
        getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/42/uuid-1.jpg' } })
        single.mockResolvedValue({
            data: {
                id: 'photo-1',
                created_at: '2026-01-01T00:00:00Z',
                point_id: 42,
                bucket_name: PHOTOS_BUCKET,
                storage_path: '42/uuid-1.jpg',
                alt_text: 'Socket photo',
                sort_order: 7,
            },
            error: null,
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.unstubAllGlobals()
    })

    it('uploadPhoto sanitizes extension, writes storage first, then inserts DB row with public URL', async () => {
        const { uploadPhoto } = await import('@/admin/lib/adminApi/photos')
        const file = new File(['image'], 'photo.exe', { type: 'image/jpeg' })

        const photo = await uploadPhoto(42, file, 'Socket photo', 7)

        expect(storageFrom).toHaveBeenCalledWith(PHOTOS_BUCKET)
        expect(upload).toHaveBeenCalledWith('42/uuid-1.jpg', file, {
            contentType: 'image/jpeg',
            upsert: false,
        })
        expect(fromTable).toHaveBeenCalledWith('map_point_photos')
        expect(insert).toHaveBeenCalledWith({
            point_id: 42,
            bucket_name: PHOTOS_BUCKET,
            storage_path: '42/uuid-1.jpg',
            alt_text: 'Socket photo',
            sort_order: 7,
        })
        expect(photo.public_url).toBe('https://cdn.example/42/uuid-1.jpg')
    })

    it('uploadPhoto rolls back the uploaded file when DB insert fails', async () => {
        const { uploadPhoto } = await import('@/admin/lib/adminApi/photos')
        single.mockResolvedValueOnce({
            data: null,
            error: { message: 'insert denied' },
        })

        await expect(uploadPhoto(42, new File(['image'], 'photo.png', { type: 'image/png' }), null, 1)).rejects.toThrow(
            'insert denied',
        )

        expect(upload).toHaveBeenCalledWith('42/uuid-1.png', expect.any(File), {
            contentType: 'image/png',
            upsert: false,
        })
        expect(remove).toHaveBeenCalledWith(['42/uuid-1.png'])
    })
})
