import { describe, expect, it } from 'vitest'
import {
    buildAnnouncementPreviewBody,
    buildAnnouncementPreviewHeader,
    pendingAnnouncementChats,
} from '@/utils/eventAnnounce'
import type { AdminEvent, AdminEventAnnouncement, AdminEventDate, AdminTelegramChat } from '@/admin/lib/adminApi/types'

const UUID = '11111111-2222-3333-4444-555555555555'

function makeDate(over: Partial<AdminEventDate> = {}): AdminEventDate {
    return { id: UUID, starts_at: '2026-07-10T14:00:00.000Z', note: null, cancelled: false, ...over }
}

function makeEvent(over: Partial<AdminEvent> = {}): AdminEvent {
    return {
        id: 5,
        created_at: '2026-01-01T00:00:00Z',
        type: 'training',
        title: 'Обучение новичков',
        description: null,
        photo_path: null,
        duration_minutes: null,
        location_text: null,
        start_coordinates: null,
        finish_coordinates: null,
        start_point_id: null,
        finish_point_id: null,
        flag_disabled: false,
        ...over,
    }
}

describe('buildAnnouncementPreviewHeader', () => {
    it('включает метку типа, заголовок, день недели и дату', () => {
        const header = buildAnnouncementPreviewHeader(makeEvent(), makeDate())
        expect(header).toContain('Обучение')
        expect(header).toContain('Обучение новичков')
        expect(header).toContain('10 июля')
        // День недели присутствует перед датой (название зависит от зоны раннера — проверяем сам факт).
        expect(header).toMatch(/📅 \S+, 10 июля/u)
    })

    it('без даты, если starts_at некорректен', () => {
        const header = buildAnnouncementPreviewHeader(makeEvent(), makeDate({ starts_at: 'bad' }))
        expect(header).not.toContain('📅')
    })

    it('опускает тип, если первое слово типа и названия совпадают', () => {
        const event = makeEvent({ type: 'training', title: 'Обучение по пятницам на КБТУ' })
        const header = buildAnnouncementPreviewHeader(event, makeDate())
        // type=training → «Обучение»; совпало с первым словом названия → без «Обучение ·»
        expect(header).not.toContain('Обучение · ')
        expect(header).toContain('Обучение по пятницам на КБТУ')
    })

    it('сохраняет тип, если первое слово не совпадает', () => {
        const event = makeEvent({ type: 'training', title: 'Вечерний разбор' })
        const header = buildAnnouncementPreviewHeader(event, makeDate())
        expect(header).toContain('Обучение · Вечерний разбор')
    })
})

describe('buildAnnouncementPreviewBody', () => {
    it('включает заметку и место', () => {
        const body = buildAnnouncementPreviewBody(
            makeEvent({ location_text: 'Сайран' }),
            makeDate({ note: 'езда спиной вперёд' }),
        )
        expect(body).toContain('езда спиной вперёд')
        expect(body).toContain('Сайран')
    })

    it('пустая строка без заметки и места', () => {
        const body = buildAnnouncementPreviewBody(makeEvent(), makeDate())
        expect(body).toBe('')
    })
})

function makeChat(over: Partial<AdminTelegramChat> = {}): AdminTelegramChat {
    return {
        id: 'chat-1',
        chat_id: 100,
        title: 'Чат',
        enabled: true,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        message_thread_id: null,
        ...over,
    }
}

function makeAnnouncement(over: Partial<AdminEventAnnouncement> = {}): AdminEventAnnouncement {
    return {
        id: 'ann-1',
        created_at: '2026-07-01T00:00:00Z',
        event_date_id: 'd1',
        telegram_chat_id: 100,
        message_thread_id: null,
        telegram_message_id: 55,
        body_text: '',
        photo_path: null,
        sent_at: '2026-07-01T00:00:01Z',
        send_error: null,
        cancelled_at: null,
        deleted_at: null,
        pinned_at: null,
        ...over,
    }
}

describe('pendingAnnouncementChats', () => {
    it('исключает чат с живым сообщением (тот же chat_id+тема)', () => {
        const chats = [makeChat({ id: 'a', chat_id: 100 }), makeChat({ id: 'b', chat_id: 200 })]
        const sent = [makeAnnouncement({ telegram_chat_id: 100 })]
        const pending = pendingAnnouncementChats(chats, sent)
        expect(pending.map((c) => c.id)).toEqual(['b'])
    })

    it('различает темы одного чата', () => {
        const chats = [
            makeChat({ id: 'general', chat_id: 100, message_thread_id: null }),
            makeChat({ id: 'topic', chat_id: 100, message_thread_id: 42 }),
        ]
        // отправлено только в General → тема 42 остаётся доступной
        const sent = [makeAnnouncement({ telegram_chat_id: 100, message_thread_id: null })]
        const pending = pendingAnnouncementChats(chats, sent)
        expect(pending.map((c) => c.id)).toEqual(['topic'])
    })

    it('удалённые/отменённые/ошибочные не считаются отправленными', () => {
        const chats = [makeChat({ id: 'a', chat_id: 100 })]
        const deleted = [makeAnnouncement({ telegram_chat_id: 100, deleted_at: '2026-07-02T00:00:00Z' })]
        const cancelled = [makeAnnouncement({ telegram_chat_id: 100, cancelled_at: '2026-07-02T00:00:00Z' })]
        const failed = [makeAnnouncement({ telegram_chat_id: 100, telegram_message_id: null, send_error: 'blocked' })]
        expect(pendingAnnouncementChats(chats, deleted).map((c) => c.id)).toEqual(['a'])
        expect(pendingAnnouncementChats(chats, cancelled).map((c) => c.id)).toEqual(['a'])
        expect(pendingAnnouncementChats(chats, failed).map((c) => c.id)).toEqual(['a'])
    })
})
