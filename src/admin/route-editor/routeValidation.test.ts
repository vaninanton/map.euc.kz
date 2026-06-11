import { describe, it, expect } from 'vitest'
import { validateRouteTitleTrimmed, validateMinimumVertices } from './routeValidation'

describe('validateRouteTitleTrimmed', () => {
    it('возвращает null для допустимого названия', () => {
        expect(validateRouteTitleTrimmed('Алмата кольцо')).toBeNull()
    })

    it('возвращает ошибку если название короче 4 символов', () => {
        expect(validateRouteTitleTrimmed('AB')).not.toBeNull()
        expect(validateRouteTitleTrimmed('ABC')).not.toBeNull()
    })

    it('возвращает null для названия ровно 4 символа', () => {
        expect(validateRouteTitleTrimmed('Abcd')).toBeNull()
    })

    it('возвращает ошибку если название длиннее 99 символов', () => {
        expect(validateRouteTitleTrimmed('А'.repeat(100))).not.toBeNull()
    })

    it('возвращает null для названия ровно 99 символов', () => {
        expect(validateRouteTitleTrimmed('А'.repeat(99))).toBeNull()
    })
})

describe('validateMinimumVertices', () => {
    it('возвращает null при 2 или более вершинах', () => {
        expect(validateMinimumVertices(2)).toBeNull()
        expect(validateMinimumVertices(10)).toBeNull()
    })

    it('возвращает ошибку при 0 вершинах', () => {
        expect(validateMinimumVertices(0)).not.toBeNull()
    })

    it('возвращает ошибку при 1 вершине', () => {
        expect(validateMinimumVertices(1)).not.toBeNull()
    })
})
