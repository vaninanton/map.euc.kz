import { describe, expect, it } from 'vitest'
import { parseAdminMapPoint, parseAdminMapRoute } from '@/admin/lib/adminApi/parsers'

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
