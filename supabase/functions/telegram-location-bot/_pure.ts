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
    // Эфемерные (приватные внутри чата) сообщения: кому адресовано и id внутри чата.
    receiver_user?: TelegramUser
    ephemeral_message_id?: number
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

/**
 * Текст отменённого анонса: «❌ ОТМЕНЕНО» + зачёркнутый исходный текст.
 *
 * message_text — уже готовый HTML (шапка с <b>/<tg-time> + экранированное тело), поэтому
 * его НЕЛЬЗЯ повторно экранировать (escapeHtml превратил бы теги в видимый текст —
 * «<b>», «<tg-time …>»). Живой <tg-time format="r"> сворачиваем в его фолбэк-текст:
 * относительный таймер у отменённого события бессмыслен, а кастомный тег внутри <s>
 * Telegram не зачёркивает.
 */
export function buildCancelledAnnouncementText(messageText: string): string {
    const withoutLiveTime = messageText.replace(/<tg-time\b[^>]*>([\s\S]*?)<\/tg-time>/gi, '$1')
    return `❌ <b>ОТМЕНЕНО</b>\n\n<s>${withoutLiveTime}</s>`
}

/**
 * Текст новости проекта для Telegram: свободное тело админа, экранированное для parse_mode HTML.
 * Без шапки и кнопок (в отличие от анонса события) — новость это просто текст (+ опц. фото).
 */
export function buildNewsText(body: string): string {
    return escapeHtml(body.trim())
}

/** Окно «сейчас катает»: райдер активен, если его последняя геопозиция не старше стольких минут. */
export const ACTIVE_RIDER_WINDOW_MINUTES = 60
/** Порог «райдер на точке»: если ближайшая точка не дальше — показываем её как ориентир. */
export const RIDER_AT_POINT_THRESHOLD_METERS = 500

/** Активный райдер (последняя live-геопозиция) — для подсчёта «кроме тебя катают» и ближайшего. */
export type ActiveRider = {
    telegramUserId: number
    username: string | null
    firstName: string | null
    longitude: number
    latitude: number
}

/** Именованная точка карты (для ориентира «у <точка>»). */
export type NamedPoint = {
    title: string
    longitude: number
    latitude: number
}

/** Ближайший к пользователю райдер + опциональный ориентир-точка. */
export type NearestRider = {
    name: string
    distanceMeters: number
    atPointTitle: string | null
}

/** Расстояние по дуге большого круга в метрах (WGS84). */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const earthRadiusM = 6_371_000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    return 2 * earthRadiusM * Math.asin(Math.sqrt(h))
}

/** «130 м» (округление до 10 м) для дистанций < 1 км, иначе «1.2 км». */
export function formatDistance(meters: number): string {
    if (!Number.isFinite(meters)) return ''
    if (meters < 1000) {
        const rounded = Math.max(0, Math.round(meters / 10) * 10)
        // 995–999 м округлились бы до «1000 м» — красивее показать «1.0 км».
        if (rounded < 1000) return `${String(rounded)} м`
    }
    return `${(meters / 1000).toFixed(1)} км`
}

/** Русское склонение: «1 райдер», «2 райдера», «5 райдеров». */
export function pluralizeRiders(n: number): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return `${String(n)} райдер`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${String(n)} райдера`
    return `${String(n)} райдеров`
}

/** Отображаемое имя райдера: @username либо экранированное имя, иначе «райдер». */
function riderDisplayName(rider: ActiveRider): string {
    if (rider.username) return `@${rider.username}`
    const first = rider.firstName?.trim()
    return first ? escapeHtml(first) : 'райдер'
}

/**
 * Ближайший к (userLon, userLat) райдер: имя, дистанция от пользователя и — если райдер
 * не дальше RIDER_AT_POINT_THRESHOLD_METERS от какой-либо точки — её название как ориентир.
 * Возвращает null, если активных райдеров нет. Чистая (haversine, без I/O).
 */
export function selectNearestRider(
    userLon: number,
    userLat: number,
    riders: ActiveRider[],
    points: NamedPoint[],
): NearestRider | null {
    let best: { rider: ActiveRider; distanceMeters: number } | null = null
    for (const rider of riders) {
        const distanceMeters = haversineMeters(userLat, userLon, rider.latitude, rider.longitude)
        if (!best || distanceMeters < best.distanceMeters) best = { rider, distanceMeters }
    }
    if (!best) return null

    // Ближайшая к самому райдеру точка — ориентир, только если он реально рядом с ней.
    let atPointTitle: string | null = null
    let bestPointMeters = Number.POSITIVE_INFINITY
    for (const point of points) {
        const d = haversineMeters(best.rider.latitude, best.rider.longitude, point.latitude, point.longitude)
        if (d < bestPointMeters) {
            bestPointMeters = d
            if (d <= RIDER_AT_POINT_THRESHOLD_METERS) atPointTitle = escapeHtml(point.title)
            else atPointTitle = null
        }
    }

    return { name: riderDisplayName(best.rider), distanceMeters: best.distanceMeters, atPointTitle }
}

/**
 * Эфемерная (видна только автору внутри чата) карточка при СТАРТЕ live-геопозиции:
 * ссылка на себя на карте, сколько ещё райдеров онлайн и ближайший из них (с ориентиром),
 * призыв делиться чаще. Deep-link на свою метку — /m/telegramuser/<id>.
 */
export function buildLiveLocationEphemeralText(input: {
    mapBaseUrl: string
    telegramUserId: number
    otherRidersCount: number
    nearest: NearestRider | null
}): string {
    const selfUrl = `${input.mapBaseUrl}/m/telegramuser/${String(input.telegramUserId)}`
    const lines = [`📍 Твоя геопозиция отображается на <a href="${selfUrl}">map.euc.kz</a>`]

    if (input.otherRidersCount <= 0 || !input.nearest) {
        lines.push('Пока ты катаешь один — зови остальных!')
    } else {
        lines.push(`Кроме тебя катают: ${pluralizeRiders(input.otherRidersCount)}`)
        const at = input.nearest.atPointTitle ? `, у ${input.nearest.atPointTitle}` : ''
        lines.push(
            `Ближайший к тебе райдер: ${input.nearest.name} (${formatDistance(input.nearest.distanceMeters)}${at})`,
        )
    }

    lines.push('')
    lines.push(
        'Делитесь геопозицией чаще — в конце сезона подведём классную статистику по самым популярным маршрутам города 🛞',
    )
    return lines.join('\n')
}

/**
 * Эфемерная (видна только нажавшему кнопку внутри чата) карточка-подтверждение RSVP:
 * при записи — «ты в списке» + шапка события (тип · название · дата) + ссылка на страницу;
 * при выходе — «ты больше не участвуешь» + шапка. Ссылка — /events/:id (не /m/event/:id).
 */
export function buildRsvpEphemeralText(
    event: AnnouncementEvent,
    startsAtIso: string,
    joined: boolean,
    mapBaseUrl: string,
): string {
    const header = buildAnnouncementHeader(event, startsAtIso)
    if (!joined) {
        return `Ты больше не участвуешь.\n\n${header}`
    }
    const eventUrl = `${mapBaseUrl}/events/${String(event.id)}`
    return `Ты в списке участников! 🛞\n\n${header}\n\n<a href="${eventUrl}">Открыть событие на карте</a>`
}
