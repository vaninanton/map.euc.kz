import { describe, expect, it } from 'vitest'
import {
    parseAdminEvent,
    parseAdminEventAnnouncement,
    parseAdminEventDate,
    parseAdminEventParticipant,
    parseAdminMapPoint,
    parseAdminMapRoute,
    parseAdminNews,
    parseAdminNewsAnnouncement,
    parseAdminTelegramChat,
    parseAnnounceResult,
} from '@/admin/lib/adminApi/parsers'

describe('adminApi parsers', () => {
    it('parseAdminMapPoint принимает валидную строку', () => {
        const row = parseAdminMapPoint({
            id: 1,
            created_at: '2025-01-01T00:00:00Z',
            type: 'point',
            title: 'Test point',
            description: null,
            coordinates: [76.9, 43.2],
            flag_is_meeting: false,
            flag_has_socket: false,
            flag_erlan: false,
            flag_disabled: false,
        })
        expect(row.id).toBe(1)
        expect(row.coordinates).toEqual([76.9, 43.2])
        expect(row.photo_count).toBe(0)
    })

    it('parseAdminMapPoint читает photo_count из map_point_photos(count)', () => {
        const row = parseAdminMapPoint({
            id: 2,
            created_at: '2025-01-01T00:00:00Z',
            type: 'point',
            title: 'With photos',
            description: null,
            coordinates: [76.9, 43.2],
            flag_is_meeting: false,
            flag_has_socket: false,
            flag_erlan: false,
            flag_disabled: false,
            map_point_photos: [{ count: 3 }],
        })
        expect(row.photo_count).toBe(3)
    })

    it('parseAdminMapPoint возвращает photo_count=0 если map_point_photos отсутствует', () => {
        const row = parseAdminMapPoint({
            id: 3,
            created_at: '2025-01-01T00:00:00Z',
            type: 'socket',
            title: 'No photos',
            description: null,
            coordinates: [76.9, 43.2],
            flag_is_meeting: false,
            flag_has_socket: true,
            flag_erlan: false,
            flag_disabled: false,
        })
        expect(row.photo_count).toBe(0)
    })

    it('parseAdminMapRoute парсит координаты с высотой', () => {
        const row = parseAdminMapRoute({
            id: 2,
            created_at: '2025-01-01T00:00:00Z',
            title: 'Route',
            description: 'd',
            coordinates: [
                [1, 2, 3],
                [4, 5, 6],
            ],
            via_coordinates: [[2, 3]],
            flag_erlan: false,
            flag_disabled: false,
        })
        expect(row.coordinates).toEqual([
            [1, 2, 3],
            [4, 5, 6],
        ])
        expect(row.via_coordinates).toEqual([[2, 3]])
    })

    it('parseAdminMapRoute нормализует via_coordinates в пустой массив', () => {
        const row = parseAdminMapRoute({
            id: 3,
            created_at: '2025-01-01T00:00:00Z',
            title: 'Route no via',
            description: null,
            coordinates: [
                [1, 2],
                [4, 5],
            ],
            flag_erlan: false,
            flag_disabled: false,
        })
        expect(row.via_coordinates).toEqual([])
    })

    it('parseAdminMapPoint отклоняет неверный type', () => {
        expect(() =>
            parseAdminMapPoint({
                id: 1,
                created_at: 'x',
                type: 'invalid',
                title: 't',
                description: null,
                coordinates: [0, 0],
                flag_is_meeting: false,
                flag_has_socket: false,
                flag_erlan: false,
                flag_disabled: false,
            }),
        ).toThrow()
    })
})

describe('parseAdminEvent', () => {
    function validRow(overrides: Record<string, unknown> = {}) {
        return {
            id: 5,
            created_at: '2026-06-01T00:00:00Z',
            type: 'group_ride',
            title: 'Покатушка',
            description: 'Описание',
            photo_path: 'events/5/photo.jpg',
            duration_minutes: 90,
            location_text: 'Парк',
            start_coordinates: [76.9, 43.2],
            finish_coordinates: [76.95, 43.25],
            start_point_id: 11,
            finish_point_id: 12,
            flag_disabled: false,
            ...overrides,
        }
    }

    it('принимает валидную строку и нормализует поля', () => {
        const event = parseAdminEvent(validRow())
        expect(event).toEqual({
            id: 5,
            created_at: '2026-06-01T00:00:00Z',
            type: 'group_ride',
            title: 'Покатушка',
            description: 'Описание',
            photo_path: 'events/5/photo.jpg',
            duration_minutes: 90,
            location_text: 'Парк',
            start_coordinates: [76.9, 43.2],
            finish_coordinates: [76.95, 43.25],
            start_point_id: 11,
            finish_point_id: 12,
            flag_disabled: false,
        })
    })

    it('нормализует пустые/невалидные опциональные поля в null', () => {
        const event = parseAdminEvent(
            validRow({
                description: null,
                photo_path: null,
                duration_minutes: null,
                location_text: null,
                start_coordinates: null,
                finish_coordinates: null,
                start_point_id: null,
                finish_point_id: null,
            }),
        )
        expect(event.description).toBeNull()
        expect(event.photo_path).toBeNull()
        expect(event.duration_minutes).toBeNull()
        expect(event.start_coordinates).toBeNull()
        expect(event.finish_point_id).toBeNull()
    })

    it('отклоняет нечисловой id', () => {
        expect(() => parseAdminEvent(validRow({ id: 'x' }))).toThrow()
    })

    it('отклоняет неизвестный type', () => {
        expect(() => parseAdminEvent(validRow({ type: 'party' }))).toThrow()
    })

    it('отклоняет нестроковый title', () => {
        expect(() => parseAdminEvent(validRow({ title: 42 }))).toThrow()
    })

    it('отклоняет не-boolean flag_disabled', () => {
        expect(() => parseAdminEvent(validRow({ flag_disabled: 'no' }))).toThrow()
    })

    it('отклоняет не-объект', () => {
        expect(() => parseAdminEvent(null)).toThrow()
        expect(() => parseAdminEvent('строка')).toThrow()
    })
})

describe('parseAdminEventDate', () => {
    it('принимает валидную дату', () => {
        const date = parseAdminEventDate({
            id: 'date-1',
            starts_at: '2026-07-01T16:00:00Z',
            note: 'Сбор у фонтана',
            cancelled: false,
        })
        expect(date).toEqual({
            id: 'date-1',
            starts_at: '2026-07-01T16:00:00Z',
            note: 'Сбор у фонтана',
            cancelled: false,
        })
    })

    it('нормализует отсутствующий note в null и трактует non-true cancelled как false', () => {
        const date = parseAdminEventDate({
            id: 'date-2',
            starts_at: '2026-07-02T16:00:00Z',
        })
        expect(date.note).toBeNull()
        expect(date.cancelled).toBe(false)
    })

    it('распознаёт cancelled только при строгом true', () => {
        expect(parseAdminEventDate({ id: 'd', starts_at: 'x', cancelled: true }).cancelled).toBe(true)
        expect(parseAdminEventDate({ id: 'd', starts_at: 'x', cancelled: 1 }).cancelled).toBe(false)
    })

    it('отклоняет нестроковый id и starts_at', () => {
        expect(() => parseAdminEventDate({ id: 5, starts_at: 'x' })).toThrow()
        expect(() => parseAdminEventDate({ id: 'd', starts_at: 5 })).toThrow()
    })

    it('parseAdminEventParticipant читает join telegram_profiles как объект', () => {
        const p = parseAdminEventParticipant({
            telegram_user_id: 42,
            created_at: '2026-07-01T00:00:00Z',
            telegram_profiles: {
                username: 'rider',
                first_name: 'Иван',
                last_name: null,
                avatar_url: 'https://a/x.jpg',
            },
        })
        expect(p).toEqual({
            telegram_user_id: 42,
            created_at: '2026-07-01T00:00:00Z',
            username: 'rider',
            first_name: 'Иван',
            last_name: null,
            avatar_url: 'https://a/x.jpg',
        })
    })

    it('parseAdminEventParticipant читает join как массив и null-аватар', () => {
        const p = parseAdminEventParticipant({
            telegram_user_id: 7,
            created_at: '2026-07-01T00:00:00Z',
            telegram_profiles: [{ username: null, first_name: null, last_name: null, avatar_url: null }],
        })
        expect(p.username).toBeNull()
        expect(p.avatar_url).toBeNull()
    })

    it('parseAdminEventParticipant отклоняет нечисловой telegram_user_id', () => {
        expect(() => parseAdminEventParticipant({ telegram_user_id: 'x', created_at: 'y' })).toThrow()
    })

    it('parseAdminEventAnnouncement нормализует nullable-поля', () => {
        const a = parseAdminEventAnnouncement({
            id: 'a1',
            created_at: '2026-07-01T00:00:00Z',
            event_date_id: 'd1',
            telegram_chat_id: 131396,
            message_thread_id: 42,
            telegram_message_id: 55,
            body_text: 'Сбор у фонтана',
            photo_path: 'events/5/a.jpg',
            sent_at: '2026-07-01T00:00:01Z',
            send_error: null,
            cancelled_at: null,
            deleted_at: null,
            pinned_at: '2026-07-01T01:00:00Z',
        })
        expect(a.telegram_message_id).toBe(55)
        expect(a.message_thread_id).toBe(42)
        expect(a.body_text).toBe('Сбор у фонтана')
        expect(a.photo_path).toBe('events/5/a.jpg')
        expect(a.sent_at).toBe('2026-07-01T00:00:01Z')
        expect(a.cancelled_at).toBeNull()
        expect(a.deleted_at).toBeNull()
        expect(a.pinned_at).toBe('2026-07-01T01:00:00Z')
    })

    it('parseAdminEventAnnouncement подставляет пустой body_text и null photo_path по умолчанию', () => {
        const a = parseAdminEventAnnouncement({
            id: 'a2',
            created_at: '2026-07-01T00:00:00Z',
            event_date_id: 'd1',
            telegram_chat_id: 1,
            telegram_message_id: null,
            sent_at: null,
            send_error: 'blocked',
            cancelled_at: null,
        })
        expect(a.body_text).toBe('')
        expect(a.photo_path).toBeNull()
        expect(a.message_thread_id).toBeNull()
    })

    it('parseAnnounceResult нормализует sent/failed', () => {
        const r = parseAnnounceResult({
            sent: [{ chat_id: 1, message_id: 10 }],
            failed: [{ chat_id: 2, error: 'blocked' }],
        })
        expect(r.sent).toEqual([{ chat_id: 1, message_id: 10 }])
        expect(r.failed).toEqual([{ chat_id: 2, error: 'blocked' }])
    })

    it('parseAnnounceResult сохраняет pinned, когда оно boolean', () => {
        const r = parseAnnounceResult({
            sent: [
                { chat_id: 1, message_id: 10, pinned: true },
                { chat_id: 2, message_id: 20, pinned: false },
            ],
            failed: [],
        })
        expect(r.sent).toEqual([
            { chat_id: 1, message_id: 10, pinned: true },
            { chat_id: 2, message_id: 20, pinned: false },
        ])
    })

    it('parseAnnounceResult подставляет дефолтную ошибку и пустые массивы', () => {
        const r = parseAnnounceResult({ failed: [{ chat_id: 2 }] })
        expect(r.sent).toEqual([])
        expect(r.failed).toEqual([{ chat_id: 2, error: 'send_failed' }])
    })

    it('parseAdminTelegramChat принимает валидную строку (без темы → message_thread_id=null)', () => {
        const c = parseAdminTelegramChat({
            id: 'd-1',
            chat_id: 131396,
            title: 'Личка',
            enabled: true,
            sort_order: 0,
            created_at: '2026-07-01T00:00:00Z',
        })
        expect(c).toEqual({
            id: 'd-1',
            chat_id: 131396,
            title: 'Личка',
            enabled: true,
            sort_order: 0,
            created_at: '2026-07-01T00:00:00Z',
            message_thread_id: null,
        })
    })

    it('parseAdminTelegramChat читает message_thread_id', () => {
        const c = parseAdminTelegramChat({
            id: 'd-2',
            chat_id: -100,
            title: 'Форум',
            enabled: true,
            sort_order: 0,
            created_at: 'x',
            message_thread_id: 17,
        })
        expect(c.message_thread_id).toBe(17)
    })

    it('parseAdminTelegramChat отклоняет неверные типы', () => {
        expect(() =>
            parseAdminTelegramChat({ chat_id: 'x', title: 't', enabled: true, sort_order: 0, created_at: 'y' }),
        ).toThrow()
        expect(() =>
            parseAdminTelegramChat({ chat_id: 1, title: 't', enabled: 'yes', sort_order: 0, created_at: 'y' }),
        ).toThrow()
    })

    it('parseAdminNews принимает валидную строку и нормализует photo_path', () => {
        const n = parseAdminNews({ id: 'n-1', created_at: 'x', body: 'Привет', photo_path: null })
        expect(n).toEqual({ id: 'n-1', created_at: 'x', body: 'Привет', photo_path: null })
        expect(parseAdminNews({ id: 'n-1', created_at: 'x', body: 'b', photo_path: 'p.jpg' }).photo_path).toBe('p.jpg')
    })

    it('parseAdminNews отклоняет отсутствующее body', () => {
        expect(() => parseAdminNews({ id: 'n-1', created_at: 'x' })).toThrow()
    })

    it('parseAdminNewsAnnouncement нормализует nullable-поля', () => {
        const a = parseAdminNewsAnnouncement({
            id: 'a-1',
            created_at: 'x',
            news_id: 'n-1',
            telegram_chat_id: -100,
            message_thread_id: null,
            telegram_message_id: 10,
            photo_path: null,
            sent_at: 'y',
            send_error: null,
            deleted_at: null,
        })
        expect(a.news_id).toBe('n-1')
        expect(a.telegram_message_id).toBe(10)
        expect(a.deleted_at).toBeNull()
    })

    it('parseAdminNewsAnnouncement отклоняет неверный telegram_chat_id', () => {
        expect(() =>
            parseAdminNewsAnnouncement({ id: 'a-1', created_at: 'x', news_id: 'n-1', telegram_chat_id: 'nope' }),
        ).toThrow()
    })
})
