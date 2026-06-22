import { describe, expect, it } from 'vitest'
import {
    parseAdminEvent,
    parseAdminEventDate,
    parseAdminMapPoint,
    parseAdminMapRoute,
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
})
