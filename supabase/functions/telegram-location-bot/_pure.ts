/**
 * Чистые функции telegram-location-bot — без I/O, без Deno.serve, без Supabase-клиента.
 * Вынесены отдельно, чтобы покрывать unit-тестами (deno test) без сетевых/env-зависимостей.
 */

export type TelegramLocation = {
    longitude: number
    latitude: number
    horizontal_accuracy?: number
    live_period?: number
    heading?: number
    proximity_alert_radius?: number
}

export type TelegramUser = {
    id: number
    username?: string
    first_name?: string
    last_name?: string
}

export type TelegramChat = {
    id: number
    type?: string
    title?: string
}

export type TelegramMessage = {
    message_id: number
    from?: TelegramUser
    chat: TelegramChat
    text?: string
    location?: TelegramLocation
}

export type TelegramInlineQuery = {
    id: string
    from: TelegramUser
    query: string
    offset: string
}

export type TelegramInlineQueryResultArticle = {
    type: 'article'
    id: string
    title: string
    description?: string
    input_message_content: {
        message_text: string
        parse_mode?: string
        disable_web_page_preview?: boolean
    }
    url?: string
    reply_markup?: {
        inline_keyboard: Array<Array<{ text: string; url: string }>>
    }
}

export type TelegramInlineQueryResultPhoto = {
    type: 'photo'
    id: string
    photo_url: string
    thumbnail_url?: string
    title?: string
    description?: string
    caption?: string
    parse_mode?: string
    reply_markup?: {
        inline_keyboard: Array<Array<{ text: string; url: string }>>
    }
}

export type TelegramCallbackQuery = {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
}

export type TelegramUpdate = {
    update_id: number
    message?: TelegramMessage
    edited_message?: TelegramMessage
    channel_post?: TelegramMessage
    edited_channel_post?: TelegramMessage
    inline_query?: TelegramInlineQuery
    callback_query?: TelegramCallbackQuery
}

export type EventTypeValue = 'group_ride' | 'event' | 'training'

export type AnnouncementEvent = {
    id: number
    type: EventTypeValue
    title: string
    location_text: string | null
}

export const TELEGRAM_AVATARS_BUCKET = 'telegram-avatars'
export const BACKFILL_ERROR_SAMPLE_LIMIT = 20
/** Максимум профилей за один вызов backfill (защита от DoS и таймаутов Edge). */
export const DEFAULT_BACKFILL_MAX_PROFILES_PER_RUN = 500

export const RSVP_CALLBACK_PREFIX = 'rsvp:'
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const EVENT_TYPE_LABELS: Record<EventTypeValue, string> = {
    group_ride: 'Покатушка',
    event: 'Мероприятие',
    training: 'Обучение',
}

export const MONTH_NAMES = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
]

/** Дни недели по индексу Date.getDay()/Intl (0 — воскресенье). */
export const WEEKDAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

/** en-US weekday short → индекс WEEKDAY_NAMES (0 — воскресенье). */
const EN_WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
}

/** Возвращает первое сообщение update'а, содержащее location (приоритет: message → edited → channel). */
export function getMessageWithLocation(update: TelegramUpdate): TelegramMessage | null {
    const candidates = [update.message, update.edited_message, update.channel_post, update.edited_channel_post]

    for (const candidate of candidates) {
        if (candidate?.location) {
            return candidate
        }
    }

    return null
}

/** Безопасен ли avatar_url: в нём не должно быть bot-токена (api.telegram.org/file/bot…). */
export function isAvatarUrlSafe(avatarUrl: string | null | undefined): boolean {
    if (!avatarUrl) return false
    return !avatarUrl.includes('api.telegram.org/file/bot')
}

/**
 * Читает положительное целое из env-строки.
 * Если значение отсутствует/некорректно — возвращает `fallback`.
 */
export function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
    if (!raw || !raw.trim()) return fallback
    const n = Number.parseInt(raw.trim(), 10)
    if (!Number.isFinite(n) || n < 1) return fallback
    return n
}

/** Экранирование текста для parse_mode HTML. */
export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Парсит callback_data кнопки «Участвую»: `rsvp:<uuid>` → { eventDateId } либо null.
 * Защищает от мусора и переполнения (uuid строго 36 символов).
 */
export function parseRsvpCallbackData(data: string | undefined): { eventDateId: string } | null {
    if (!data || !data.startsWith(RSVP_CALLBACK_PREFIX)) return null
    const id = data.slice(RSVP_CALLBACK_PREFIX.length)
    return UUID_RE.test(id) ? { eventDateId: id } : null
}

/** Подпись кнопки «Участвую»: без участников — без числа, иначе «Участвую (N)». */
export function formatParticipateButtonLabel(count: number): string {
    return count > 0 ? `Участвую (${String(count)})` : 'Участвую'
}

/**
 * Инлайн-клавиатура анонса: кнопка «Участвую» (callback) + «Открыть на карте» (deep link).
 * ВАЖНО: держать формат шапки/кнопок в синхроне с src/utils/eventAnnounce.ts.
 */
export function buildRsvpKeyboard(
    eventDateId: string,
    count: number,
    mapBaseUrl: string,
    eventId: number,
): {
    inline_keyboard: Array<
        Array<{ text: string; callback_data?: string; style?: string; icon_custom_emoji_id?: number; url?: string }>
    >
} {
    return {
        inline_keyboard: [
            [
                {
                    text: formatParticipateButtonLabel(count),
                    style: 'primary',
                    callback_data: `${RSVP_CALLBACK_PREFIX}${eventDateId}`,
                },
                // Страница события — каноничный путь /events/:id (см. src/utils/eventLinks.ts),
                // а НЕ /m/:type/:id (тот формат для точек/маршрутов и тип event не знает).
                { text: 'map.euc.kz', url: `${mapBaseUrl}/events/${String(eventId)}` },
            ],
        ],
    }
}

/** Таймзона события — Алматы (UTC+5, без DST). Время в анонсе показываем именно в ней. */
export const EVENT_TIME_ZONE = 'Asia/Almaty'

/**
 * Разбирает ISO-дату в компоненты календаря таймзоны Алматы (день недели 0-6, день, месяц 0-11,
 * часы, минуты). Возвращает null для невалидной даты. Использует Intl, чтобы не зависеть от
 * таймзоны раннера (Edge Functions крутятся в UTC — getUTCHours дал бы 14:00 вместо 19:00 по Алматы).
 */
function getAlmatyDateParts(
    iso: string,
): { weekday: number; day: number; month: number; hours: number; minutes: number } | null {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: EVENT_TIME_ZONE,
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(d)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? ''
    // hour12:false может вернуть «24» для полуночи — нормализуем в 0.
    const rawHours = get('hour')
    return {
        weekday: EN_WEEKDAY_INDEX[weekdayShort] ?? 0,
        day: get('day'),
        month: get('month') - 1,
        hours: rawHours === 24 ? 0 : rawHours,
        minutes: get('minute'),
    }
}

/** Абсолютное «понедельник, 14 июля, 19:00» по Алматы. */
function formatAlmatyDateTime(iso: string): string {
    const p = getAlmatyDateParts(iso)
    return p
        ? `${WEEKDAY_NAMES[p.weekday]}, ${String(p.day)} ${MONTH_NAMES[p.month]}, ${String(p.hours).padStart(2, '0')}:${String(p.minutes).padStart(2, '0')}`
        : ''
}

/**
 * Строка времени анонса: абсолютное по Алматы + относительный отсчёт в скобках —
 * «вторник, 14 июля, 19:00 (через 3 часа)». Относительная часть — тег <tg-time format="r">,
 * который Telegram рендерит вживую в зоне каждого пользователя (unix — в секундах);
 * текст внутри тега — фолбэк для клиентов без поддержки.
 */
function buildEventTimeLine(startsAtIso: string): string {
    const d = new Date(startsAtIso)
    if (Number.isNaN(d.getTime())) return ''
    const absolute = escapeHtml(formatAlmatyDateTime(startsAtIso))
    const unix = Math.floor(d.getTime() / 1000)
    return `${absolute} (<tg-time unix="${String(unix)}" format="r">скоро</tg-time>)`
}

/** Первое слово строки, в нижнем регистре, без обрамляющей пунктуации — для сравнения тип↔название. */
function firstWordKey(text: string): string {
    return (text.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Метка типа + название через «·», но если первое слово названия совпадает с первым словом
 * типа — тип опускаем (чтобы не было «Обучение · Обучение по пятницам…»). Возвращает уже
 * экранированный HTML-фрагмент.
 */
export function buildAnnouncementTitleHead(typeLabel: string, title: string): string {
    const boldTitle = `<b>${escapeHtml(title)}</b>`
    if (firstWordKey(typeLabel) && firstWordKey(typeLabel) === firstWordKey(title)) {
        return boldTitle
    }
    return `${escapeHtml(typeLabel)} · ${boldTitle}`
}

/**
 * Фиксированная шапка анонса: «Покатушка · Название · 📅 вторник, 14 июля, 19:00 (через 3 часа)».
 * Абсолютное время — в зоне Алматы; относительный отсчёт через <tg-time> Telegram
 * рендерит в зоне получателя. Эта строка добавляется сервером и не редактируется админом.
 * ВАЖНО: держать в синхроне с buildAnnouncementPreviewHeader в src/utils/eventAnnounce.ts.
 */
export function buildAnnouncementHeader(event: AnnouncementEvent, startsAtIso: string): string {
    const timeLine = buildEventTimeLine(startsAtIso)
    const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type
    const head = buildAnnouncementTitleHead(typeLabel, event.title)
    return timeLine ? `${head}\n📅 ${timeLine}` : head
}

/** Полный текст анонса: фиксированная шапка + свободный текст админа. */
export function buildAnnouncementText(event: AnnouncementEvent, startsAtIso: string, body: string): string {
    const header = buildAnnouncementHeader(event, startsAtIso)
    const trimmed = body.trim()
    return trimmed ? `${header}\n\n${escapeHtml(trimmed)}` : header
}
