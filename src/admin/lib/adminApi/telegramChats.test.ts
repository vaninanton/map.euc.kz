import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runManyParsed, runOneParsed, fromTable, db } = vi.hoisted(() => {
    const fromTable = vi.fn()
    return {
        runManyParsed: vi.fn(),
        runOneParsed: vi.fn(),
        fromTable,
        db: vi.fn(() => ({ from: fromTable })),
    }
})

vi.mock('@/admin/lib/adminApi/query', () => ({
    db,
    runManyParsed,
    runOneParsed,
}))
vi.mock('@/admin/lib/adminApi/parsers', () => ({
    parseAdminTelegramChat: (raw: unknown) => raw,
}))

import {
    createTelegramChat,
    deleteTelegramChat,
    listTelegramChats,
    updateTelegramChat,
} from '@/admin/lib/adminApi/telegramChats'

beforeEach(() => {
    vi.clearAllMocks()
    db.mockReturnValue({ from: fromTable })
})

describe('listTelegramChats', () => {
    it('читает чаты, отсортированные по sort_order', async () => {
        const order = vi.fn()
        const select = vi.fn(() => ({ order }))
        fromTable.mockReturnValue({ select })
        runManyParsed.mockResolvedValue([])

        await listTelegramChats()

        expect(fromTable).toHaveBeenCalledWith('telegram_chats')
        expect(order).toHaveBeenCalledWith('sort_order', { ascending: true })
    })
})

describe('createTelegramChat', () => {
    it('вставляет чат и возвращает запись', async () => {
        const single = vi.fn()
        const select = vi.fn(() => ({ single }))
        const insert = vi.fn(() => ({ select }))
        fromTable.mockReturnValue({ insert })
        runOneParsed.mockResolvedValue({ chat_id: 1 })

        await createTelegramChat({ chat_id: 1, title: 'Чат', enabled: true, sort_order: 0 })

        expect(insert).toHaveBeenCalledWith({ chat_id: 1, title: 'Чат', enabled: true, sort_order: 0 })
    })
})

describe('updateTelegramChat', () => {
    it('обновляет назначение по id', async () => {
        const single = vi.fn()
        const select = vi.fn(() => ({ single }))
        const eq = vi.fn(() => ({ select }))
        const update = vi.fn(() => ({ eq }))
        fromTable.mockReturnValue({ update })
        runOneParsed.mockResolvedValue({ id: 'd-1' })

        await updateTelegramChat('d-1', { enabled: false })

        expect(update).toHaveBeenCalledWith({ enabled: false })
        expect(eq).toHaveBeenCalledWith('id', 'd-1')
    })
})

describe('deleteTelegramChat', () => {
    it('удаляет назначение по id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        fromTable.mockReturnValue({ delete: vi.fn(() => ({ eq })) })

        await deleteTelegramChat('d-1')

        expect(eq).toHaveBeenCalledWith('id', 'd-1')
    })

    it('бросает ошибку при сбое удаления', async () => {
        const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
        fromTable.mockReturnValue({ delete: vi.fn(() => ({ eq })) })

        await expect(deleteTelegramChat('d-1')).rejects.toThrow('boom')
    })
})
