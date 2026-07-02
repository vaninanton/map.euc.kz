/**
 * Чистые функции edge-функции ai-assist: билдер промпта, валидация входа и ответа OpenAI.
 *
 * ВАЖНО: тип AiAssistEntity и buildAiAssistPrompt — копия src/admin/utils/aiAssistPrompt.ts
 * (Deno не импортирует из src/). Правки синхронизировать в обеих копиях.
 */

/** Плоские данные объекта карты для промпта — без зависимостей от типов adminApi. */
export type AiAssistEntity =
    | {
          kind: 'point'
          pointType: 'point' | 'socket'
          title: string
          description: string
          coordinates: [number, number] // [lng, lat]
          flagIsMeeting: boolean
          flagHasSocket: boolean
          flagErlan: boolean
      }
    | {
          kind: 'route'
          title: string
          description: string
          startCoordinates: [number, number] // [lng, lat]
          endCoordinates: [number, number]
          vertexCount: number
          flagErlan: boolean
      }

const FLAG_MEETING_LABEL = 'Место встречи'
const FLAG_SOCKET_LABEL = 'Есть розетка'
const FLAG_ERLAN_LABEL = 'Ерландия (самые сложные горные маршруты — проезжает только Ерлан)'

/** Форматирует [lng, lat] как «широта, долгота» с округлением до 6 знаков. */
function formatLatLng(coordinates: [number, number]): string {
    const round = (n: number) => String(Math.round(n * 1e6) / 1e6)
    return `${round(coordinates[1])}, ${round(coordinates[0])}`
}

function formatFlags(flags: string[]): string {
    return flags.length > 0 ? flags.join('; ') : 'нет'
}

function buildContextLines(entity: AiAssistEntity): string[] {
    if (entity.kind === 'point') {
        const flags: string[] = []
        if (entity.flagIsMeeting) flags.push(FLAG_MEETING_LABEL)
        if (entity.flagHasSocket) flags.push(FLAG_SOCKET_LABEL)
        if (entity.flagErlan) flags.push(FLAG_ERLAN_LABEL)
        return [
            `Объект: ${entity.pointType === 'socket' ? 'Розетка' : 'Точка'}`,
            `Координаты: ${formatLatLng(entity.coordinates)} (широта, долгота)`,
            `Признаки: ${formatFlags(flags)}`,
        ]
    }
    const flags: string[] = []
    if (entity.flagErlan) flags.push(FLAG_ERLAN_LABEL)
    return [
        'Объект: Маршрут',
        `Старт: ${formatLatLng(entity.startCoordinates)} (широта, долгота)`,
        `Финиш: ${formatLatLng(entity.endCoordinates)} (широта, долгота)`,
        `Вершин: ${String(entity.vertexCount)}`,
        `Признаки: ${formatFlags(flags)}`,
    ]
}

/**
 * Строит промпт (по-русски) для улучшения названия и описания объекта карты.
 * При webSearch (по умолчанию) добавляет инструкции про проверку фактов в интернете
 * и поиск точек интереса (pois); без него pois не запрашиваются.
 */
export function buildAiAssistPrompt(entity: AiAssistEntity, options?: { webSearch?: boolean }): string {
    const webSearch = options?.webSearch ?? true
    const title = entity.title.trim()
    const description = entity.description.trim()

    const lines: string[] = [
        'Ты редактор карты map.euc.kz для райдеров моноколёс (EUC) в Алматы.',
        'Улучши название и описание объекта карты на русском языке.',
        '',
        ...buildContextLines(entity),
        '',
        title ? `Текущее название: «${title}»` : 'Текущее название: (отсутствует)',
        description ? `Текущее описание:\n«${description}»` : 'Описание отсутствует — составь его с нуля по контексту.',
        '',
        'Требования:',
        '- Название: от 4 до 99 символов, ёмкое и конкретное, без кавычек и эмодзи; не добавляй город и страну — вся карта про Алматы.',
        '- Описание: 1–3 коротких предложения с полезными райдеру деталями (ориентиры, покрытие, зарядка).',
        '- Признаки выше — служебный контекст, они уже показаны на карте метками: не цитируй их, не упоминай слова «Ерландия» и «Ерлан». Их суть (сложный горный рельеф, розетка, место сбора) при желании передай своими словами.',
        '- Исправь орфографию, пунктуацию и стиль, сохрани все факты из исходного текста.',
        '- Не выдумывай факты, которых нет в исходных данных.',
        ...(webSearch
            ? [
                  '- Если доступен поиск в интернете — используй его для проверки фактов и поиска точек интереса.',
                  '- Найди 2–3 точки интереса рядом с объектом (кафе, зарядка, вода, виды, сервис) и верни их в списке pois,',
                  '  каждая строкой «Название — чем полезна райдеру». Если уверенных вариантов нет — верни пустой список.',
              ]
            : []),
        '- В значениях JSON — только чистый текст: без markdown, без ссылок, без сносок и упоминаний источников.',
        '',
        'Ответ верни строго одним JSON-объектом без пояснений и markdown:',
        webSearch
            ? '{"title": "...", "description": "...", "pois": ["Название — чем полезна", "..."]}'
            : '{"title": "...", "description": "..."}',
    ]
    return lines.join('\n')
}

function isLngLat(raw: unknown): raw is [number, number] {
    return (
        Array.isArray(raw) &&
        raw.length === 2 &&
        typeof raw[0] === 'number' &&
        Number.isFinite(raw[0]) &&
        typeof raw[1] === 'number' &&
        Number.isFinite(raw[1])
    )
}

/** Валидирует тело запроса и возвращает типизированный AiAssistEntity либо null. */
export function parseAiAssistEntity(raw: unknown): AiAssistEntity | null {
    if (typeof raw !== 'object' || raw === null) return null
    const obj = raw as Record<string, unknown>
    if (typeof obj.title !== 'string' || typeof obj.description !== 'string') return null
    if (typeof obj.flagErlan !== 'boolean') return null

    if (obj.kind === 'point') {
        if (obj.pointType !== 'point' && obj.pointType !== 'socket') return null
        if (!isLngLat(obj.coordinates)) return null
        if (typeof obj.flagIsMeeting !== 'boolean' || typeof obj.flagHasSocket !== 'boolean') return null
        return {
            kind: 'point',
            pointType: obj.pointType,
            title: obj.title,
            description: obj.description,
            coordinates: obj.coordinates,
            flagIsMeeting: obj.flagIsMeeting,
            flagHasSocket: obj.flagHasSocket,
            flagErlan: obj.flagErlan,
        }
    }

    if (obj.kind === 'route') {
        if (!isLngLat(obj.startCoordinates) || !isLngLat(obj.endCoordinates)) return null
        if (typeof obj.vertexCount !== 'number' || !Number.isInteger(obj.vertexCount) || obj.vertexCount < 2)
            return null
        return {
            kind: 'route',
            title: obj.title,
            description: obj.description,
            startCoordinates: obj.startCoordinates,
            endCoordinates: obj.endCoordinates,
            vertexCount: obj.vertexCount,
            flagErlan: obj.flagErlan,
        }
    }

    return null
}

/** Предложение нейросети: улучшенные название/описание и точки интереса рядом. */
export interface AiSuggestion {
    title: string
    description: string
    pois: string[]
}

/**
 * Вычищает из текста сноски-цитаты web-поиска OpenAI и markdown-ссылки:
 * «([site](url))», «([a](u), [b](v))» удаляются целиком, «[текст](url)» → «текст»,
 * голые URL в скобках удаляются. Модель игнорирует запрет ссылок в промпте.
 */
function stripInlineLinks(text: string): string {
    return text
        .replace(/\s*\((?:\[[^\]]*\]\([^()]*\)(?:,\s*)?)+\)/g, '')
        .replace(/\[([^\]]*)\]\([^()]*\)/g, '$1')
        .replace(/\s*\(https?:\/\/[^)]*\)/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}

/**
 * Парсит ответ модели: срезает возможные markdown-ограждения, валидирует JSON
 * `{title, description, pois?}`, вычищает ссылки/сноски из значений. Название
 * обрезается до 99 символов; короче 4 — ошибка. pois — до 3 непустых строк,
 * при мусоре — пустой список.
 */
export function parseAiSuggestion(raw: unknown): AiSuggestion | null {
    if (typeof raw !== 'string') return null
    const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')

    let parsed: unknown
    try {
        parsed = JSON.parse(cleaned)
    } catch {
        return null
    }
    if (typeof parsed !== 'object' || parsed === null) return null
    const obj = parsed as Record<string, unknown>
    if (typeof obj.title !== 'string' || typeof obj.description !== 'string') return null

    const title = stripInlineLinks(obj.title).slice(0, 99)
    const description = stripInlineLinks(obj.description)
    if (title.length < 4 || !description) return null

    const pois = Array.isArray(obj.pois)
        ? obj.pois
              .filter((p): p is string => typeof p === 'string')
              .map(stripInlineLinks)
              .filter(Boolean)
              .slice(0, 3)
        : []
    return { title, description, pois }
}

/**
 * Извлекает текст ответа из payload OpenAI Responses API: конкатенация
 * output_text-фрагментов последнего message-элемента output.
 */
export function extractResponsesOutputText(payload: unknown): string | null {
    if (typeof payload !== 'object' || payload === null) return null
    const output = (payload as Record<string, unknown>).output
    if (!Array.isArray(output)) return null

    for (let i = output.length - 1; i >= 0; i--) {
        const item = output[i] as Record<string, unknown> | null
        if (item?.type !== 'message' || !Array.isArray(item.content)) continue
        const text = (item.content as Array<Record<string, unknown>>)
            .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
            .map((part) => part.text as string)
            .join('')
        if (text) return text
    }
    return null
}
