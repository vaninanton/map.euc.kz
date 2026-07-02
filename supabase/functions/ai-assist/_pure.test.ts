import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
    buildAiAssistPrompt,
    extractResponsesOutputText,
    parseAiAssistEntity,
    parseAiSuggestion,
    type AiAssistEntity,
} from './_pure.ts'

const POINT: AiAssistEntity = {
    kind: 'point',
    pointType: 'point',
    title: 'Роща Баума',
    description: 'Тенистая роща.',
    coordinates: [76.945, 43.238],
    flagIsMeeting: true,
    flagHasSocket: false,
    flagErlan: false,
}

const ROUTE: AiAssistEntity = {
    kind: 'route',
    title: 'Терренкур',
    description: 'Вдоль речки.',
    startCoordinates: [76.945, 43.238],
    endCoordinates: [76.95, 43.24],
    vertexCount: 12,
    flagErlan: true,
}

Deno.test('buildAiAssistPrompt: точка — тип, координаты «широта, долгота», признаки', () => {
    const prompt = buildAiAssistPrompt(POINT)
    assertEquals(prompt.includes('Объект: Точка'), true)
    assertEquals(prompt.includes('Координаты: 43.238, 76.945 (широта, долгота)'), true)
    assertEquals(prompt.includes('Признаки: Место встречи'), true)
    assertEquals(
        prompt.includes('{"title": "...", "description": "...", "pois": ["Название — чем полезна", "..."]}'),
        true,
    )
})

Deno.test('buildAiAssistPrompt: маршрут — старт/финиш/вершины, Ерландия', () => {
    const prompt = buildAiAssistPrompt(ROUTE)
    assertEquals(prompt.includes('Объект: Маршрут'), true)
    assertEquals(prompt.includes('Старт: 43.238, 76.945 (широта, долгота)'), true)
    assertEquals(prompt.includes('Вершин: 12'), true)
    assertEquals(prompt.includes('Ерландия (самые сложные горные маршруты — проезжает только Ерлан)'), true)
    assertEquals(prompt.includes('не упоминай слова «Ерландия» и «Ерлан»'), true)
    assertEquals(prompt.includes('не добавляй город и страну'), true)
})

Deno.test('buildAiAssistPrompt: webSearch=false — без интернет-инструкций и pois', () => {
    const prompt = buildAiAssistPrompt(POINT, { webSearch: false })
    assertEquals(prompt.includes('поиск в интернете'), false)
    assertEquals(prompt.includes('pois'), false)
    assertEquals(prompt.includes('{"title": "...", "description": "..."}'), true)
})

Deno.test('parseAiAssistEntity: валидная точка и маршрут проходят', () => {
    assertEquals(parseAiAssistEntity(POINT), POINT)
    assertEquals(parseAiAssistEntity(ROUTE), ROUTE)
})

Deno.test('parseAiAssistEntity: мусор отклоняется', () => {
    assertEquals(parseAiAssistEntity(null), null)
    assertEquals(parseAiAssistEntity('строка'), null)
    assertEquals(parseAiAssistEntity({}), null)
    assertEquals(parseAiAssistEntity({ ...POINT, kind: 'event' }), null)
    assertEquals(parseAiAssistEntity({ ...POINT, coordinates: [76.945] }), null)
    assertEquals(parseAiAssistEntity({ ...POINT, coordinates: ['76.9', '43.2'] }), null)
    assertEquals(parseAiAssistEntity({ ...POINT, flagIsMeeting: 'да' }), null)
    assertEquals(parseAiAssistEntity({ ...ROUTE, vertexCount: 1 }), null)
    assertEquals(parseAiAssistEntity({ ...ROUTE, vertexCount: 2.5 }), null)
})

Deno.test('parseAiSuggestion: чистый JSON проходит, pois опциональны', () => {
    assertEquals(parseAiSuggestion('{"title": "Роща Баума", "description": "Тенистая роща у входа."}'), {
        title: 'Роща Баума',
        description: 'Тенистая роща у входа.',
        pois: [],
    })
})

Deno.test('parseAiSuggestion: markdown-ограждения срезаются', () => {
    assertEquals(parseAiSuggestion('```json\n{"title": "Роща Баума", "description": "Роща."}\n```'), {
        title: 'Роща Баума',
        description: 'Роща.',
        pois: [],
    })
})

Deno.test('parseAiSuggestion: pois — до 3 непустых строк, мусор отбрасывается', () => {
    const raw = JSON.stringify({
        title: 'Роща Баума',
        description: 'Роща.',
        pois: ['Кафе — кофе', '  ', 42, 'Родник — вода', 'Сервис — ремонт', 'Лишняя — четвёртая'],
    })
    assertEquals(parseAiSuggestion(raw)?.pois, ['Кафе — кофе', 'Родник — вода', 'Сервис — ремонт'])
    assertEquals(parseAiSuggestion('{"title": "Роща Баума", "description": "Роща.", "pois": "не массив"}')?.pois, [])
})

Deno.test('extractResponsesOutputText: берёт output_text из последнего message', () => {
    const payload = {
        output: [
            { type: 'web_search_call', id: 'ws_1' },
            {
                type: 'message',
                content: [
                    { type: 'output_text', text: '{"title": "А", ' },
                    { type: 'output_text', text: '"description": "Б"}' },
                ],
            },
        ],
    }
    assertEquals(extractResponsesOutputText(payload), '{"title": "А", "description": "Б"}')
    assertEquals(extractResponsesOutputText({ output: [] }), null)
    assertEquals(extractResponsesOutputText(null), null)
    assertEquals(extractResponsesOutputText({ output: [{ type: 'message', content: [] }] }), null)
})

Deno.test('parseAiSuggestion: название триммится и обрезается до 99 символов', () => {
    const long = 'а'.repeat(150)
    const parsed = parseAiSuggestion(JSON.stringify({ title: `  ${long}  `, description: 'Ок.' }))
    assertEquals(parsed?.title.length, 99)
})

Deno.test('parseAiSuggestion: сноски web-поиска и markdown-ссылки вычищаются', () => {
    const raw = JSON.stringify({
        title: 'Визит-центр Аюсай ([wiki](https://ru.wikipedia.org/wiki/Аюсай?utm_source=openai))',
        description:
            'Розетка на здании туалета справа от входа. ([tengrinews.kz](https://tengrinews.kz/guide-map_object/40/amp/?utm_source=openai))',
        pois: [
            'Tary — этно-кофейня при визит-центре. ([sxodim.com](https://sxodim.com/almaty/place/kofeynya-tary?utm_source=openai))',
            'Водопад Аюсай — [живописная точка](https://naturalist.travel/x) для отдыха (https://example.com/page)',
        ],
    })
    assertEquals(parseAiSuggestion(raw), {
        title: 'Визит-центр Аюсай',
        description: 'Розетка на здании туалета справа от входа.',
        pois: ['Tary — этно-кофейня при визит-центре.', 'Водопад Аюсай — живописная точка для отдыха'],
    })
})

Deno.test('parseAiSuggestion: сноска с несколькими источниками удаляется целиком', () => {
    const raw = JSON.stringify({
        title: 'Роща Баума',
        description: 'Тенистая роща. ([a](https://a.kz/1), [b](https://b.kz/2))',
    })
    assertEquals(parseAiSuggestion(raw)?.description, 'Тенистая роща.')
})

Deno.test('parseAiSuggestion: невалидные ответы отклоняются', () => {
    assertEquals(parseAiSuggestion(undefined), null)
    assertEquals(parseAiSuggestion('не json'), null)
    assertEquals(parseAiSuggestion('{"title": "аб", "description": "Ок."}'), null)
    assertEquals(parseAiSuggestion('{"title": "Роща Баума", "description": ""}'), null)
    assertEquals(parseAiSuggestion('{"title": "Роща Баума"}'), null)
    assertEquals(parseAiSuggestion('[1, 2]'), null)
})
