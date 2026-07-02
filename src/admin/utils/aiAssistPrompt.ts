/**
 * Билдер промпта для улучшения названия и описания объекта карты через внешнюю нейросеть.
 *
 * ВАЖНО: модуль намеренно самодостаточный (ноль импортов) — при добавлении edge-функции
 * «Улучшить с ИИ» он копируется в supabase/functions/<fn>/_pure.ts (Deno не импортирует
 * из src/). Правки синхронизировать в обеих копиях.
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
