import { describe, expect, it } from 'vitest'
import { formatAgo, isBotStale } from '@/admin/utils/adminTime'

const NOW = new Date('2026-07-02T12:00:00+00:00')

describe('formatAgo', () => {
    it('минуты, часы, дни', () => {
        expect(formatAgo('2026-07-02T11:59:40+00:00', NOW)).toBe('только что')
        expect(formatAgo('2026-07-02T11:45:00+00:00', NOW)).toBe('15 мин назад')
        expect(formatAgo('2026-07-02T09:00:00+00:00', NOW)).toBe('3 ч назад')
        expect(formatAgo('2026-06-25T12:00:00+00:00', NOW)).toBe('7 дн назад')
    })

    it('будущее время не даёт отрицательных значений', () => {
        expect(formatAgo('2026-07-02T12:05:00+00:00', NOW)).toBe('только что')
    })

    it('невалидная дата — прочерк', () => {
        expect(formatAgo('мусор', NOW)).toBe('—')
    })
})

describe('isBotStale', () => {
    it('свежая геопозиция — не stale', () => {
        expect(isBotStale('2026-07-02T09:00:00+00:00', NOW)).toBe(false)
    })

    it('старше 48 часов — stale', () => {
        expect(isBotStale('2026-06-29T12:00:00+00:00', NOW)).toBe(true)
    })

    it('null и невалидная дата — stale', () => {
        expect(isBotStale(null, NOW)).toBe(true)
        expect(isBotStale('мусор', NOW)).toBe(true)
    })
})
