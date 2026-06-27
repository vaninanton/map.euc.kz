import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runManyParsed, runOneParsed, storageRemove, storageFrom, tableUpdate, fromTable, db } = vi.hoisted(() => {
    const storageRemove = vi.fn()
    const storageUpload = vi.fn()
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://cdn/x' } }))
    const storageFrom = vi.fn(() => ({ remove: storageRemove, upload: storageUpload, getPublicUrl }))
    const tableUpdate = vi.fn()
    const fromTable = vi.fn(() => ({ update: tableUpdate }))
    return {
        runManyParsed: vi.fn(),
        runOneParsed: vi.fn(),
        storageRemove,
        storageFrom,
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
    parseAdminNews: (raw: unknown) => raw,
}))

import { createNews, deleteNews, listNews } from '@/admin/lib/adminApi/news'

beforeEach(() => {
    vi.clearAllMocks()
    db.mockReturnValue({ from: fromTable, storage: { from: storageFrom } })
    fromTable.mockReturnValue({ update: tableUpdate })
    storageFrom.mockReturnValue({ remove: storageRemove } as never)
})

describe('listNews', () => {
    it('читает только не удалённые, новые сверху', async () => {
        const order = vi.fn()
        const isFn = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ is: isFn }))
        fromTable.mockReturnValue({ select } as never)
        runManyParsed.mockResolvedValue([])

        await listNews()

        expect(fromTable).toHaveBeenCalledWith('map_news')
        expect(isFn).toHaveBeenCalledWith('deleted_at', null)
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    })
})

describe('createNews', () => {
    it('вставляет тело и возвращает запись', async () => {
        const single = vi.fn()
        const select = vi.fn(() => ({ single }))
        const insert = vi.fn(() => ({ select }))
        fromTable.mockReturnValue({ insert } as never)
        runOneParsed.mockResolvedValue({ id: 'n-1' })

        await createNews({ body: 'Привет' })

        expect(insert).toHaveBeenCalledWith({ body: 'Привет' })
    })
})

describe('deleteNews', () => {
    it('мягко удаляет (deleted_at) и удаляет фото из Storage', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        tableUpdate.mockReturnValue({ eq })
        storageRemove.mockResolvedValue({ error: null })

        await deleteNews({ id: 'n-1', photo_path: 'n-1/p.jpg' })

        expect(storageFrom).toHaveBeenCalledWith('map-news-photos')
        expect(storageRemove).toHaveBeenCalledWith(['n-1/p.jpg'])
        const payload = tableUpdate.mock.calls[0]?.[0] as { deleted_at?: unknown }
        expect(typeof payload.deleted_at).toBe('string')
        expect(eq).toHaveBeenCalledWith('id', 'n-1')
    })

    it('без фото не трогает Storage', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        tableUpdate.mockReturnValue({ eq })

        await deleteNews({ id: 'n-1', photo_path: null })

        expect(storageRemove).not.toHaveBeenCalled()
    })

    it('бросает ошибку при сбое обновления', async () => {
        const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
        tableUpdate.mockReturnValue({ eq })

        await expect(deleteNews({ id: 'n-1', photo_path: null })).rejects.toThrow('boom')
    })
})
