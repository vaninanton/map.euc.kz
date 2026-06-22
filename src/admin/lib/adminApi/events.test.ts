import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Мокаем слой запросов: тестируем оркестрацию events.ts, а не PostgREST-цепочки.
// vi.hoisted — иначе фабрика vi.mock не сможет сослаться на эти моки (она поднимается выше).
const {
    runManyParsed,
    runOneParsed,
    storageUpload,
    storageRemove,
    getPublicUrl,
    storageFrom,
    tableDelete,
    tableUpdate,
    fromTable,
    db,
} = vi.hoisted(() => {
    const storageUpload = vi.fn()
    const storageRemove = vi.fn()
    const getPublicUrl = vi.fn()
    const storageFrom = vi.fn(() => ({ upload: storageUpload, remove: storageRemove, getPublicUrl }))
    const tableDelete = vi.fn()
    const tableUpdate = vi.fn()
    const fromTable = vi.fn(() => ({ delete: tableDelete, update: tableUpdate }))
    return {
        runManyParsed: vi.fn(),
        runOneParsed: vi.fn(),
        storageUpload,
        storageRemove,
        getPublicUrl,
        storageFrom,
        tableDelete,
        tableUpdate,
        fromTable,
        db: vi.fn(() => ({ from: fromTable, storage: { from: storageFrom } })),
    }
})

vi.mock('@/admin/lib/adminApi/query', () => ({
    db,
    runManyParsed,
    runOneParsed,
}))
vi.mock('@/admin/lib/adminApi/parsers', () => ({
    parseAdminEvent: (raw: unknown) => raw,
    parseAdminEventDate: (raw: unknown) => raw,
}))

import {
    addEventDate,
    deleteEvent,
    deleteEventDate,
    deleteEventPhoto,
    eventPhotoUrl,
    setEventPhoto,
    updateEventDate,
} from '@/admin/lib/adminApi/events'

const EVENT = { id: 7, photo_path: 'events/7/old.jpg' }

beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks стирает реализации vi.fn(() => ...) — восстанавливаем дефолтные цепочки.
    db.mockReturnValue({ from: fromTable, storage: { from: storageFrom } })
    storageFrom.mockReturnValue({ upload: storageUpload, remove: storageRemove, getPublicUrl })
    fromTable.mockReturnValue({ delete: tableDelete, update: tableUpdate })
    // crypto.randomUUID — детерминированный путь для setEventPhoto.
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555')
})

afterEach(() => {
    vi.restoreAllMocks()
})

// Цепочка update().eq().select().single(); её результат не важен — строку отдаёт мок runOneParsed.
function mockUpdateChain() {
    tableUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn() }) }),
    })
}

// Цепочка delete().eq() с заданным результатом.
function mockDeleteResult(error: { message: string } | null) {
    tableDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error }) })
}

describe('deleteEvent', () => {
    it('удаляет фото из Storage перед удалением строки события', async () => {
        storageRemove.mockResolvedValue({ error: null })
        mockDeleteResult(null)

        await deleteEvent({ id: 7, photo_path: 'events/7/p.jpg' })

        expect(storageFrom).toHaveBeenCalledWith('map-event-photos')
        expect(storageRemove).toHaveBeenCalledWith(['events/7/p.jpg'])
        expect(fromTable).toHaveBeenCalledWith('map_events')
    })

    it('не трогает Storage, если у события нет фото', async () => {
        mockDeleteResult(null)

        await deleteEvent({ id: 7, photo_path: null })

        expect(storageRemove).not.toHaveBeenCalled()
    })

    it('бросает ошибку при сбое удаления строки', async () => {
        mockDeleteResult({ message: 'fk violation' })

        await expect(deleteEvent({ id: 7, photo_path: null })).rejects.toThrow('fk violation')
    })
})

describe('setEventPhoto', () => {
    function makeFile(name: string) {
        return new File(['x'], name, { type: 'image/png' })
    }

    it('загружает фото, обновляет путь и удаляет предыдущее фото', async () => {
        storageUpload.mockResolvedValue({ error: null })
        storageRemove.mockResolvedValue({ error: null })
        runOneParsed.mockResolvedValue({ id: 7, photo_path: 'events/7/new.png' })
        mockUpdateChain()

        const result = await setEventPhoto(7, makeFile('shot.png'), EVENT.photo_path)

        expect(storageUpload).toHaveBeenCalledWith('7/11111111-2222-3333-4444-555555555555.png', expect.any(File), {
            contentType: 'image/png',
            upsert: false,
        })
        // Старое фото удалено только после успешного обновления.
        expect(storageRemove).toHaveBeenCalledWith(['events/7/old.jpg'])
        expect(result).toEqual({ id: 7, photo_path: 'events/7/new.png' })
    })

    it('нормализует расширение .jpeg → .jpg и неизвестное → .jpg', async () => {
        storageUpload.mockResolvedValue({ error: null })
        runOneParsed.mockResolvedValue({ id: 7 })
        mockUpdateChain()

        await setEventPhoto(7, makeFile('photo.JPEG'), null)
        expect(storageUpload).toHaveBeenLastCalledWith(
            '7/11111111-2222-3333-4444-555555555555.jpg',
            expect.any(File),
            expect.anything(),
        )

        await setEventPhoto(7, makeFile('photo.gif'), null)
        expect(storageUpload).toHaveBeenLastCalledWith(
            '7/11111111-2222-3333-4444-555555555555.jpg',
            expect.any(File),
            expect.anything(),
        )
    })

    it('откатывает загрузку (удаляет новый файл), если обновление строки упало', async () => {
        storageUpload.mockResolvedValue({ error: null })
        storageRemove.mockResolvedValue({ error: null })
        runOneParsed.mockRejectedValue(new Error('update failed'))
        mockUpdateChain()

        await expect(setEventPhoto(7, makeFile('shot.png'), EVENT.photo_path)).rejects.toThrow('update failed')

        // Новый файл удалён при откате; старый — нет.
        expect(storageRemove).toHaveBeenCalledWith(['7/11111111-2222-3333-4444-555555555555.png'])
        expect(storageRemove).not.toHaveBeenCalledWith(['events/7/old.jpg'])
    })

    it('бросает ошибку при сбое загрузки и не обновляет строку', async () => {
        storageUpload.mockResolvedValue({ error: { message: 'storage full' } })

        await expect(setEventPhoto(7, makeFile('shot.png'), null)).rejects.toThrow('storage full')
        expect(runOneParsed).not.toHaveBeenCalled()
    })
})

describe('deleteEventPhoto', () => {
    it('удаляет фото из Storage и обнуляет photo_path', async () => {
        storageRemove.mockResolvedValue({ error: null })
        runOneParsed.mockResolvedValue({ id: 7, photo_path: null })
        mockUpdateChain()

        const result = await deleteEventPhoto(7, 'events/7/p.jpg')

        expect(storageRemove).toHaveBeenCalledWith(['events/7/p.jpg'])
        expect(result).toEqual({ id: 7, photo_path: null })
    })

    it('обнуляет photo_path даже если удаление из Storage не удалось', async () => {
        storageRemove.mockResolvedValue({ error: { message: 'not found' } })
        runOneParsed.mockResolvedValue({ id: 7, photo_path: null })
        mockUpdateChain()

        const result = await deleteEventPhoto(7, 'events/7/p.jpg')
        expect(result).toEqual({ id: 7, photo_path: null })
    })
})

describe('eventPhotoUrl', () => {
    it('возвращает публичный URL из Storage', () => {
        getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/events/7/p.jpg' } })

        expect(eventPhotoUrl('events/7/p.jpg')).toBe('https://cdn/events/7/p.jpg')
        expect(storageFrom).toHaveBeenCalledWith('map-event-photos')
    })
})

describe('addEventDate', () => {
    function mockInsert(result: { data: unknown; error: unknown }) {
        const single = vi.fn().mockResolvedValue(result)
        const select = vi.fn(() => ({ single }))
        const insert = vi.fn(() => ({ select }))
        fromTable.mockReturnValue({ insert } as never)
        return { insert }
    }

    it('вставляет дату с event_id и возвращает распарсенную запись', async () => {
        const { insert } = mockInsert({ data: { id: 'd1', starts_at: 'x' }, error: null })

        const result = await addEventDate(7, { starts_at: '2026-07-01T16:00:00Z', note: null })

        expect(insert).toHaveBeenCalledWith({ event_id: 7, starts_at: '2026-07-01T16:00:00Z', note: null })
        expect(result).toEqual({ id: 'd1', starts_at: 'x' })
    })

    it('переводит ошибку UNIQUE (23505) в понятное сообщение', async () => {
        mockInsert({ data: null, error: { code: '23505', message: 'duplicate key' } })

        await expect(addEventDate(7, { starts_at: 'x', note: null })).rejects.toThrow(
            'Такая дата и время уже добавлены.',
        )
    })

    it('пробрасывает прочие ошибки как есть', async () => {
        mockInsert({ data: null, error: { code: '42501', message: 'permission denied' } })

        await expect(addEventDate(7, { starts_at: 'x', note: null })).rejects.toThrow('permission denied')
    })
})

describe('updateEventDate', () => {
    function mockUpdate(result: { data: unknown; error: unknown }) {
        const single = vi.fn().mockResolvedValue(result)
        const select = vi.fn(() => ({ single }))
        const eq = vi.fn(() => ({ select }))
        const update = vi.fn(() => ({ eq }))
        fromTable.mockReturnValue({ update } as never)
        return { update, eq }
    }

    it('обновляет дату по id', async () => {
        const { update, eq } = mockUpdate({ data: { id: 'd1' }, error: null })

        await updateEventDate('d1', { cancelled: true })

        expect(update).toHaveBeenCalledWith({ cancelled: true })
        expect(eq).toHaveBeenCalledWith('id', 'd1')
    })

    it('переводит 23505 в понятное сообщение', async () => {
        mockUpdate({ data: null, error: { code: '23505', message: 'dup' } })

        await expect(updateEventDate('d1', { starts_at: 'x' })).rejects.toThrow('Такая дата и время уже добавлены.')
    })
})

describe('deleteEventDate', () => {
    it('удаляет дату по id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        const del = vi.fn(() => ({ eq }))
        fromTable.mockReturnValue({ delete: del } as never)

        await deleteEventDate('d1')

        expect(eq).toHaveBeenCalledWith('id', 'd1')
    })

    it('бросает ошибку при сбое удаления', async () => {
        const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
        fromTable.mockReturnValue({ delete: vi.fn(() => ({ eq })) } as never)

        await expect(deleteEventDate('d1')).rejects.toThrow('boom')
    })
})
