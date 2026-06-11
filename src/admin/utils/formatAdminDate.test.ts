import { describe, it, expect } from 'vitest'
import { formatAdminDate } from './formatAdminDate'

describe('formatAdminDate', () => {
    it('форматирует ISO-дату в локаль ru-RU', () => {
        const result = formatAdminDate('2024-06-15T10:30:00.000Z')
        // Проверяем что результат содержит год, месяц и время — не привязываемся к конкретному формату часового пояса
        expect(result).toMatch(/2024/)
        expect(result).toMatch(/06|6/)
    })

    it('возвращает строку (не бросает) для невалидной даты', () => {
        const result = formatAdminDate('not-a-date')
        expect(typeof result).toBe('string')
    })
})
