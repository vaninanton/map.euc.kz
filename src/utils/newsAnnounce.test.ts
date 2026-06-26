import { describe, expect, it } from 'vitest'
import { newsTitlePreview, pendingNewsChats } from '@/utils/newsAnnounce'
import type { AdminNewsAnnouncement, AdminTelegramChat } from '@/admin/lib/adminApi/types'

const NEWS_ID = '11111111-2222-3333-4444-555555555555'

function makeChat(over: Partial<AdminTelegramChat> = {}): AdminTelegramChat {
    return {
        id: 'd-1',
        chat_id: -100,
        title: 'Чат',
        enabled: true,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        message_thread_id: null,
        ...over,
    }
}

function makeAnn(over: Partial<AdminNewsAnnouncement> = {}): AdminNewsAnnouncement {
    return {
        id: 'a-1',
        created_at: '2026-01-01T00:00:00Z',
        news_id: NEWS_ID,
        telegram_chat_id: -100,
        message_thread_id: null,
        telegram_message_id: 10,
        photo_path: null,
        sent_at: '2026-01-01T00:00:00Z',
        send_error: null,
        deleted_at: null,
        ...over,
    }
}

describe('newsTitlePreview', () => {
    it('берёт первую непустую строку', () => {
        expect(newsTitlePreview('\n  \nПривет мир\nвторая строка')).toBe('Привет мир')
    })

    it('обрезает длинную строку с многоточием', () => {
        const long = 'a'.repeat(100)
        const result = newsTitlePreview(long, 80)
        expect(result.endsWith('…')).toBe(true)
        expect(result.length).toBe(81)
    })

    it('пустое тело → пустая строка', () => {
        expect(newsTitlePreview('   \n  ')).toBe('')
    })
})

describe('pendingNewsChats', () => {
    it('исключает чаты с живым сообщением (chat_id + thread)', () => {
        const chats = [makeChat({ id: 'd-1', chat_id: -100 }), makeChat({ id: 'd-2', chat_id: -200 })]
        const anns = [makeAnn({ telegram_chat_id: -100 })]
        expect(pendingNewsChats(chats, anns).map((c) => c.id)).toEqual(['d-2'])
    })

    it('удалённое/ошибочное сообщение не считается отправленным — чат снова доступен', () => {
        const chats = [makeChat({ id: 'd-1', chat_id: -100 })]
        const deleted = [makeAnn({ telegram_chat_id: -100, deleted_at: '2026-02-01T00:00:00Z' })]
        const failed = [makeAnn({ telegram_chat_id: -100, telegram_message_id: null, send_error: 'boom' })]
        expect(pendingNewsChats(chats, deleted).map((c) => c.id)).toEqual(['d-1'])
        expect(pendingNewsChats(chats, failed).map((c) => c.id)).toEqual(['d-1'])
    })

    it('разные темы одного чата различаются', () => {
        const chats = [
            makeChat({ id: 'd-1', chat_id: -100, message_thread_id: null }),
            makeChat({ id: 'd-2', chat_id: -100, message_thread_id: 5 }),
        ]
        const anns = [makeAnn({ telegram_chat_id: -100, message_thread_id: 5 })]
        expect(pendingNewsChats(chats, anns).map((c) => c.id)).toEqual(['d-1'])
    })
})
