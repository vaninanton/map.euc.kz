import { describe, it, expect } from 'vitest'
import { buildEventDetailPath, parseEventDetailPathname } from '@/utils/eventLinks'

describe('eventLinks', () => {
    it('buildEventDetailPath формирует /events/:id с encode', () => {
        expect(buildEventDetailPath('e1')).toBe('/events/e1')
        expect(buildEventDetailPath('e 7')).toBe('/events/e%207')
    })

    it('parseEventDetailPathname извлекает id из /events/:id', () => {
        expect(parseEventDetailPathname('/events/e1')).toBe('e1')
        expect(parseEventDetailPathname('/events/e%207')).toBe('e 7')
        // с завершающим слэшем
        expect(parseEventDetailPathname('/events/e1/')).toBe('e1')
    })

    it('parseEventDetailPathname возвращает null для /events и прочих путей', () => {
        expect(parseEventDetailPathname('/events')).toBeNull()
        expect(parseEventDetailPathname('/events/')).toBeNull()
        expect(parseEventDetailPathname('/')).toBeNull()
        expect(parseEventDetailPathname('/m/point/1')).toBeNull()
        expect(parseEventDetailPathname('/events/a/b')).toBeNull()
    })
})
