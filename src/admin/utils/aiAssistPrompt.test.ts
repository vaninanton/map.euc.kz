import { describe, expect, it } from 'vitest'
import { buildAiAssistPrompt, type AiAssistEntity } from './aiAssistPrompt'

function makePoint(over: Partial<Extract<AiAssistEntity, { kind: 'point' }>> = {}): AiAssistEntity {
    return {
        kind: 'point',
        pointType: 'point',
        title: 'Роща Баума',
        description: 'Тенистая роща, удобно собираться у входа.',
        coordinates: [76.945, 43.238],
        flagIsMeeting: true,
        flagHasSocket: true,
        flagErlan: true,
        ...over,
    }
}

function makeRoute(over: Partial<Extract<AiAssistEntity, { kind: 'route' }>> = {}): AiAssistEntity {
    return {
        kind: 'route',
        title: 'Терренкур',
        description: 'Вдоль речки, асфальт.',
        startCoordinates: [76.945, 43.238],
        endCoordinates: [76.95, 43.24],
        vertexCount: 12,
        flagErlan: false,
        ...over,
    }
}

describe('buildAiAssistPrompt', () => {
    it('точка со всеми флагами: тип, признаки, название и описание в тексте', () => {
        const prompt = buildAiAssistPrompt(makePoint())
        expect(prompt).toContain('Объект: Точка')
        expect(prompt).toContain(
            'Признаки: Место встречи; Есть розетка; Ерландия (самые сложные горные маршруты — проезжает только Ерлан)',
        )
        expect(prompt).toContain('Текущее название: «Роща Баума»')
        expect(prompt).toContain('«Тенистая роща, удобно собираться у входа.»')
    })

    it('розетка: тип «Розетка»', () => {
        const prompt = buildAiAssistPrompt(makePoint({ pointType: 'socket', flagIsMeeting: false }))
        expect(prompt).toContain('Объект: Розетка')
        expect(prompt).not.toContain('Место встречи')
    })

    it('без флагов: «Признаки: нет»', () => {
        const prompt = buildAiAssistPrompt(makePoint({ flagIsMeeting: false, flagHasSocket: false, flagErlan: false }))
        expect(prompt).toContain('Признаки: нет')
    })

    it('пустое и пробельное описание: просьба составить с нуля', () => {
        for (const description of ['', '   \n  ']) {
            const prompt = buildAiAssistPrompt(makePoint({ description }))
            expect(prompt).toContain('Описание отсутствует — составь его с нуля по контексту.')
            expect(prompt).not.toContain('Текущее описание')
        }
    })

    it('пустое название: «(отсутствует)»', () => {
        const prompt = buildAiAssistPrompt(makePoint({ title: '  ' }))
        expect(prompt).toContain('Текущее название: (отсутствует)')
    })

    it('координаты: порядок «широта, долгота», округление до 6 знаков', () => {
        const prompt = buildAiAssistPrompt(makePoint({ coordinates: [76.9048481234, 43.2268071234] }))
        expect(prompt).toContain('Координаты: 43.226807, 76.904848 (широта, долгота)')
    })

    it('маршрут: старт, финиш, число вершин', () => {
        const prompt = buildAiAssistPrompt(makeRoute())
        expect(prompt).toContain('Объект: Маршрут')
        expect(prompt).toContain('Старт: 43.238, 76.945 (широта, долгота)')
        expect(prompt).toContain('Финиш: 43.24, 76.95 (широта, долгота)')
        expect(prompt).toContain('Вершин: 12')
    })

    it('маршрут с Ерландией: флаг в признаках', () => {
        const prompt = buildAiAssistPrompt(makeRoute({ flagErlan: true }))
        expect(prompt).toContain('Признаки: Ерландия (самые сложные горные маршруты — проезжает только Ерлан)')
    })

    it('webSearch: false — без интернет-инструкций и pois в формате ответа', () => {
        const prompt = buildAiAssistPrompt(makePoint(), { webSearch: false })
        expect(prompt).not.toContain('поиск в интернете')
        expect(prompt).not.toContain('точки интереса')
        expect(prompt).not.toContain('pois')
        expect(prompt).toContain('{"title": "...", "description": "..."}')
    })

    it('общая рамка присутствует для обоих видов', () => {
        for (const entity of [makePoint(), makeRoute()]) {
            const prompt = buildAiAssistPrompt(entity)
            expect(prompt).toContain('от 4 до 99 символов')
            expect(prompt).toContain('не добавляй город и страну')
            expect(prompt).toContain('не упоминай слова «Ерландия» и «Ерлан»')
            expect(prompt).toContain(
                '{"title": "...", "description": "...", "pois": ["Название — чем полезна", "..."]}',
            )
            expect(prompt).toContain('2–3 точки интереса')
            expect(prompt).toContain('map.euc.kz')
        }
    })
})
