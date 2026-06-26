import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runManyParsed, invoke, fromTable, selectFn, eqFn, orderFn, db } = vi.hoisted(() => {
    const invoke = vi.fn()
    const orderFn = vi.fn()
    const eqFn = vi.fn(() => ({ order: orderFn }))
    const selectFn = vi.fn(() => ({ eq: eqFn }))
    const fromTable = vi.fn(() => ({ select: selectFn }))
    return {
        runManyParsed: vi.fn(),
        invoke,
        fromTable,
        selectFn,
        eqFn,
        orderFn,
        db: vi.fn(() => ({ from: fromTable, functions: { invoke } })),
    }
})

vi.mock('@/admin/lib/adminApi/query', () => ({
    db,
    runManyParsed,
}))
vi.mock('@/admin/lib/adminApi/parsers', () => ({
    parseAdminNewsAnnouncement: (raw: unknown) => raw,
    parseAnnounceResult: (raw: unknown) => raw,
}))

import {
    announceNews,
    deleteNewsAnnouncements,
    editNewsAnnouncements,
    listNewsAnnouncements,
} from '@/admin/lib/adminApi/newsAnnouncements'

const NEWS_ID = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
    vi.clearAllMocks()
    db.mockReturnValue({ from: fromTable, functions: { invoke } })
    fromTable.mockReturnValue({ select: selectFn })
    selectFn.mockReturnValue({ eq: eqFn })
    eqFn.mockReturnValue({ order: orderFn })
})

describe('announceNews', () => {
    it('вызывает /news-announce с news_id и destination_ids', async () => {
        invoke.mockResolvedValue({ data: { sent: [], failed: [] }, error: null })

        const result = await announceNews(NEWS_ID, ['d-1', 'd-2'])

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/news-announce', {
            body: { news_id: NEWS_ID, destination_ids: ['d-1', 'd-2'] },
        })
        expect(result).toEqual({ sent: [], failed: [] })
    })

    it('бросает ошибку Edge Function', async () => {
        invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })
        await expect(announceNews(NEWS_ID, ['d-1'])).rejects.toThrow('boom')
    })
})

describe('editNewsAnnouncements', () => {
    it('вызывает /news-announce-edit и возвращает edited + failed', async () => {
        invoke.mockResolvedValue({ data: { edited: 3, failed: [{ chat_id: -1, error: 'x' }] }, error: null })

        const result = await editNewsAnnouncements(NEWS_ID)

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/news-announce-edit', { body: { news_id: NEWS_ID } })
        expect(result).toEqual({ edited: 3, failed: [{ chat_id: -1, error: 'x' }] })
    })

    it('failed по умолчанию пустой массив', async () => {
        invoke.mockResolvedValue({ data: { edited: 0 }, error: null })
        const result = await editNewsAnnouncements(NEWS_ID)
        expect(result).toEqual({ edited: 0, failed: [] })
    })
})

describe('deleteNewsAnnouncements', () => {
    it('вызывает /news-announce-delete и возвращает deleted', async () => {
        invoke.mockResolvedValue({ data: { deleted: 2 }, error: null })

        const result = await deleteNewsAnnouncements(NEWS_ID)

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/news-announce-delete', {
            body: { news_id: NEWS_ID },
        })
        expect(result).toEqual({ deleted: 2 })
    })
})

describe('listNewsAnnouncements', () => {
    it('читает из telegram_outbound_messages по news_id, новые сверху', async () => {
        runManyParsed.mockResolvedValue([])

        await listNewsAnnouncements(NEWS_ID)

        expect(fromTable).toHaveBeenCalledWith('telegram_outbound_messages')
        expect(eqFn).toHaveBeenCalledWith('news_id', NEWS_ID)
        expect(orderFn).toHaveBeenCalledWith('created_at', { ascending: false })
    })
})
