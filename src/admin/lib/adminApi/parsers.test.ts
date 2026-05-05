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
            flag_disabled: false,
        })
        expect(row.id).toBe(1)
        expect(row.coordinates).toEqual([76.9, 43.2])
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
            flag_disabled: false,
        })
        expect(row.coordinates).toEqual([
            [1, 2, 3],
            [4, 5, 6],
        ])
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
                flag_disabled: false,
            }),
        ).toThrow()
    })
})
