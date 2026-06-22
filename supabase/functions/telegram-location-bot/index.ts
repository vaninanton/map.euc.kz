import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type TelegramLocation = {
    longitude: number
    latitude: number
    horizontal_accuracy?: number
    live_period?: number
    heading?: number
    proximity_alert_radius?: number
}

type TelegramUser = {
    id: number
    username?: string
    first_name?: string
    last_name?: string
}

type TelegramChat = {
    id: number
    type?: string
    title?: string
}

type TelegramMessage = {
    message_id: number
    from?: TelegramUser
    chat: TelegramChat
    text?: string
    location?: TelegramLocation
}

type TelegramInlineQuery = {
    id: string
    from: TelegramUser
    query: string
    offset: string
}

type TelegramInlineQueryResultArticle = {
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

type TelegramInlineQueryResultPhoto = {
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

type TelegramUpdate = {
    update_id: number
    message?: TelegramMessage
    edited_message?: TelegramMessage
    channel_post?: TelegramMessage
    edited_channel_post?: TelegramMessage
    inline_query?: TelegramInlineQuery
}

type TelegramProfileRow = {
    telegram_user_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
}

type TelegramApiGetUserProfilePhotosResponse = {
    ok: boolean
    result?: {
        photos?: Array<Array<{ file_id: string }>>
    }
}

type TelegramApiGetFileResponse = {
    ok: boolean
    result?: {
        file_path?: string
    }
}

const TELEGRAM_AVATARS_BUCKET = 'telegram-avatars'
const BACKFILL_ERROR_SAMPLE_LIMIT = 20
/** Максимум профилей за один вызов backfill (защита от DoS и таймаутов Edge). */
const DEFAULT_BACKFILL_MAX_PROFILES_PER_RUN = 500

type AvatarRefreshResult =
    | { ok: true; avatarUrl: string }
    | {
          ok: false
          reason:
              | 'no_photo'
              | 'telegram_get_photos_failed'
              | 'telegram_get_file_failed'
              | 'telegram_file_download_failed'
              | 'unsupported_content_type'
              | 'storage_upload_failed'
              | 'unexpected_error'
      }

function getMessageWithLocation(update: TelegramUpdate): TelegramMessage | null {
    const candidates = [update.message, update.edited_message, update.channel_post, update.edited_channel_post]

    for (const candidate of candidates) {
        if (candidate?.location) {
            return candidate
        }
    }

    return null
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Отсутствуют SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function isAvatarUrlSafe(avatarUrl: string | null | undefined): boolean {
    if (!avatarUrl) return false
    return !avatarUrl.includes('api.telegram.org/file/bot')
}

async function resolveTelegramAvatarFilePath(
    userId: number,
    botToken: string,
): Promise<
    | { ok: true; filePath: string }
    | { ok: false; reason: 'no_photo' | 'telegram_get_photos_failed' | 'telegram_get_file_failed' }
> {
    const photosResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            user_id: userId,
            limit: 1,
        }),
    })

    if (!photosResponse.ok) return { ok: false, reason: 'telegram_get_photos_failed' }

    const photosPayload = (await photosResponse.json()) as TelegramApiGetUserProfilePhotosResponse
    if (!photosPayload.ok) return { ok: false, reason: 'telegram_get_photos_failed' }

    const firstPhotoSizes = photosPayload.result?.photos?.[0]
    if (!firstPhotoSizes?.length) return { ok: false, reason: 'no_photo' }

    const bestSize = firstPhotoSizes[firstPhotoSizes.length - 1]
    if (!bestSize?.file_id) return { ok: false, reason: 'no_photo' }

    const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            file_id: bestSize.file_id,
        }),
    })

    if (!fileResponse.ok) return { ok: false, reason: 'telegram_get_file_failed' }

    const filePayload = (await fileResponse.json()) as TelegramApiGetFileResponse
    const filePath = filePayload.result?.file_path
    if (!filePayload.ok || !filePath) return { ok: false, reason: 'telegram_get_file_failed' }
    return { ok: true, filePath }
}

async function uploadTelegramAvatarToStorage(
    userId: number,
    filePath: string,
    botToken: string,
): Promise<
    | { ok: true; avatarUrl: string }
    | { ok: false; reason: 'telegram_file_download_failed' | 'unsupported_content_type' | 'storage_upload_failed' }
> {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
    const fileResponse = await fetch(fileUrl)
    if (!fileResponse.ok) return { ok: false, reason: 'telegram_file_download_failed' }

    const fileExt = filePath.split('.').pop()?.toLowerCase()
    const normalizedExt = fileExt && ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt) ? fileExt : 'jpg'
    const mimeByExt: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
    }
    const headerContentType = fileResponse.headers.get('content-type')?.toLowerCase() ?? ''
    const normalizedHeaderContentType = headerContentType.split(';')[0]?.trim() ?? ''
    let contentType = mimeByExt[normalizedExt] ?? 'image/jpeg'
    if (normalizedHeaderContentType.startsWith('image/')) {
        contentType = normalizedHeaderContentType
    } else if (normalizedHeaderContentType && normalizedHeaderContentType !== 'application/octet-stream') {
        return { ok: false, reason: 'unsupported_content_type' }
    }

    const objectPath = `${String(userId)}/avatar.${normalizedExt}`
    const fileBytes = await fileResponse.arrayBuffer()

    const { error: uploadError } = await supabase.storage.from(TELEGRAM_AVATARS_BUCKET).upload(objectPath, fileBytes, {
        contentType,
        upsert: true,
    })
    if (uploadError) {
        console.warn('[telegram-location-bot] Не удалось загрузить аватар в Storage', {
            user_id: userId,
            error: uploadError,
        })
        return { ok: false, reason: 'storage_upload_failed' }
    }

    const { data } = supabase.storage.from(TELEGRAM_AVATARS_BUCKET).getPublicUrl(objectPath)
    return { ok: true, avatarUrl: data.publicUrl }
}

async function refreshTelegramAvatarUrl(userId: number, botToken: string): Promise<AvatarRefreshResult> {
    try {
        const filePathResult = await resolveTelegramAvatarFilePath(userId, botToken)
        if (!filePathResult.ok) {
            return { ok: false, reason: filePathResult.reason }
        }
        const uploadResult = await uploadTelegramAvatarToStorage(userId, filePathResult.filePath, botToken)
        if (!uploadResult.ok) {
            return { ok: false, reason: uploadResult.reason }
        }
        return { ok: true, avatarUrl: uploadResult.avatarUrl }
    } catch (error) {
        console.warn('[telegram-location-bot] Не удалось обновить avatar_url', {
            user_id: userId,
            error,
        })
        return { ok: false, reason: 'unexpected_error' }
    }
}

/**
 * Читает положительное целое из env-строки.
 * Если значение отсутствует/некорректно — возвращает `fallback`.
 */
function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
    if (!raw || !raw.trim()) return fallback
    const n = Number.parseInt(raw.trim(), 10)
    if (!Number.isFinite(n) || n < 1) return fallback
    return n
}

/**
 * Generic helper для вызова Telegram Bot API методов.
 * POST {method} с JSON body, возвращает распарсенный результат.
 */
async function callTelegramApi(
    method: string,
    body: Record<string, unknown>,
    botToken: string,
): Promise<{ ok: boolean; result?: unknown; error_code?: number; description?: string }> {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            console.error('[telegram-location-bot] Telegram API error', {
                method,
                status: response.status,
            })
            return { ok: false }
        }

        return (await response.json()) as { ok: boolean; result?: unknown; error_code?: number; description?: string }
    } catch (error) {
        console.error('[telegram-location-bot] callTelegramApi exception', {
            method,
            error,
        })
        return { ok: false }
    }
}

/**
 * Handles Telegram commands (e.g., /start).
 */
async function handleCommand(message: TelegramMessage, botToken: string): Promise<void> {
    const text = message.text?.trim()
    if (!text?.startsWith('/')) return

    const command = text.split(/\s+/)[0].toLowerCase()

    if (command === '/start') {
        // Only respond to /start in private chats
        if (message.chat.type && message.chat.type !== 'private') {
            return
        }

        const welcomeMessage = `Привет! Я бот для моноколесников и им завидующим

Что я умею:
• Отслеживаю геопозиции райдеров в реальном времени (нужно поделиться геолокацией в чате <a href="https://t.me/monoalmaty">Моноколеса Алматы</a>/<a href="https://t.me/+ADUCLEjBA5pmNjQ6">Электроклуб</a>)
• Помогаю делиться точками карты: напиши @EUCkz_bot в любом чате и выбери нужную метку

Ссылка на карту: https://map.euc.kz`

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: message.chat.id,
                text: welcomeMessage,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            },
            botToken,
        )
    }
}

/**
 * Handles Telegram inline queries — search and return points/routes/sockets.
 * Meeting points appear first in results.
 */
async function handleInlineQuery(
    inlineQuery: TelegramInlineQuery,
    botToken: string,
    mapBaseUrl: string,
): Promise<void> {
    const query = inlineQuery.query.trim()
    const searchPattern = query ? `%${query}%` : '%'

    try {
        const [meetingPointsResult, regularPointsResult, routesResult] = await Promise.all([
            supabase
                .from('map_points')
                .select('id, title, type, description')
                .eq('flag_disabled', false)
                .eq('flag_is_meeting', true)
                .ilike('title', searchPattern)
                .order('title')
                .limit(20),
            supabase
                .from('map_points')
                .select('id, title, type, description')
                .eq('flag_disabled', false)
                .eq('flag_is_meeting', false)
                .ilike('title', searchPattern)
                .order('title')
                .limit(15),
            supabase
                .from('map_routes')
                .select('id, title, description')
                .eq('flag_disabled', false)
                .ilike('title', searchPattern)
                .order('title')
                .limit(20),
        ])

        const results: Array<TelegramInlineQueryResultArticle | TelegramInlineQueryResultPhoto> = []

        // Collect all point IDs to fetch their photos in one query
        const allPoints = [...(meetingPointsResult.data ?? []), ...(regularPointsResult.data ?? [])]
        const pointIds = allPoints.map((p) => p.id)

        let photosByPointId: Record<number, string> = {}
        if (pointIds.length > 0) {
            const { data: photos } = await supabase
                .from('map_point_photos')
                .select('point_id, bucket_name, storage_path')
                .in('point_id', pointIds)
                .order('sort_order')
                .limit(pointIds.length)

            if (photos) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
                for (const photo of photos) {
                    const pointId = (photo as any).point_id
                    if (!photosByPointId[pointId]) {
                        const bucketName = (photo as any).bucket_name
                        const storagePath = (photo as any).storage_path
                        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${encodeURIComponent(storagePath)}`
                        photosByPointId[pointId] = publicUrl
                    }
                }
            }
        }

        const addPointsToResults = (points: typeof meetingPointsResult.data) => {
            if (!points) return
            for (const point of points) {
                const type = point.type === 'socket' ? 'socket' : 'point'
                const emoji = type === 'socket' ? '🔌' : '📌'
                const label = type === 'socket' ? 'Зарядная розетка' : 'Точка'
                const resultId = `${type}-${point.id}`
                const baseUrl = `${mapBaseUrl}/m/${type}/${point.id}`
                const urlWithUtm = `${baseUrl}?utm_source=telegram_bot&utm_medium=inline&utm_campaign=search`

                // Format caption/message with title and optional description
                let caption = `${emoji} <b>${point.title}</b>`
                if (point.description) {
                    caption += `\n${point.description}`
                }

                const photoUrl = photosByPointId[point.id]

                // If photo exists, use photo result type; otherwise use article
                if (photoUrl) {
                    results.push({
                        type: 'photo',
                        id: resultId,
                        photo_url: photoUrl,
                        thumbnail_url: photoUrl,
                        title: point.title,
                        description: label,
                        caption,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [[{ text: 'Показать на карте', url: urlWithUtm }]],
                        },
                    })
                } else {
                    results.push({
                        type: 'article',
                        id: resultId,
                        title: point.title,
                        description: label,
                        input_message_content: {
                            message_text: caption,
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                        },
                        url: baseUrl,
                        reply_markup: {
                            inline_keyboard: [[{ text: 'Показать на карте', url: urlWithUtm }]],
                        },
                    })
                }
            }
        }

        // Add meeting points first
        addPointsToResults(meetingPointsResult.data)
        // Then regular points
        addPointsToResults(regularPointsResult.data)

        if (routesResult.data) {
            for (const route of routesResult.data) {
                const resultId = `route-${route.id}`
                const baseUrl = `${mapBaseUrl}/m/route/${route.id}`
                const urlWithUtm = `${baseUrl}?utm_source=telegram_bot&utm_medium=inline&utm_campaign=search`

                // Format message with title and optional description
                let messageText = `🛤 <b>${route.title}</b>`
                if (route.description) {
                    messageText += `\n${route.description}`
                }

                results.push({
                    type: 'article',
                    id: resultId,
                    title: route.title,
                    description: 'Маршрут',
                    input_message_content: {
                        message_text: messageText,
                        parse_mode: 'HTML',
                        disable_web_page_preview: true,
                    },
                    url: baseUrl,
                    reply_markup: {
                        inline_keyboard: [[{ text: 'Показать на карте', url: urlWithUtm }]],
                    },
                })
            }
        }

        await callTelegramApi(
            'answerInlineQuery',
            {
                inline_query_id: inlineQuery.id,
                results: results.slice(0, 50),
                cache_time: 60,
                is_personal: false,
            },
            botToken,
        )
    } catch (error) {
        console.error('[telegram-location-bot] handleInlineQuery error', {
            inline_query_id: inlineQuery.id,
            error,
        })
        await callTelegramApi(
            'answerInlineQuery',
            {
                inline_query_id: inlineQuery.id,
                results: [],
            },
            botToken,
        )
    }
}

/**
 * Backfill для безопасного обновления `avatar_url` в `telegram_profiles`.
 *
 * Поддерживает:
 * - обязательную авторизацию заголовком `x-telegram-backfill-secret`
 * - ограничение объёма обработки за вызов (`TELEGRAM_BACKFILL_MAX_PROFILES`)
 * - продолжение с оффсета через query-параметр `from`
 */
async function handleAvatarBackfill(req: Request): Promise<Response> {
    const backfillSecret = Deno.env.get('TELEGRAM_BACKFILL_SECRET')
    if (!backfillSecret || !backfillSecret.trim()) {
        console.error('[telegram-location-bot] Backfill отключён: не задан TELEGRAM_BACKFILL_SECRET')
        return new Response('TELEGRAM_BACKFILL_SECRET не настроен', { status: 503 })
    }
    const incomingBackfill = req.headers.get('x-telegram-backfill-secret')
    if (incomingBackfill !== backfillSecret) {
        console.warn('[telegram-location-bot] Backfill отклонён: неверный x-telegram-backfill-secret')
        return new Response('Unauthorized', { status: 401 })
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) {
        return new Response('TELEGRAM_BOT_TOKEN не задан', { status: 500 })
    }

    const maxProfilesPerRun = parsePositiveIntEnv(
        Deno.env.get('TELEGRAM_BACKFILL_MAX_PROFILES'),
        DEFAULT_BACKFILL_MAX_PROFILES_PER_RUN,
    )

    const requestUrl = new URL(req.url)
    const startOffsetRaw = requestUrl.searchParams.get('from')
    const startOffset =
        startOffsetRaw !== null && startOffsetRaw.trim() !== ''
            ? Math.max(0, Number.parseInt(startOffsetRaw.trim(), 10) || 0)
            : 0

    let from = startOffset
    const pageSize = 200
    let processed = 0
    let updated = 0
    let failed = 0
    let skippedSafe = 0
    let skippedNoPhoto = 0
    const failuresByReason: Record<string, number> = {}
    const errorSamples: Array<{ telegram_user_id: number; reason: string }> = []
    let nextResumeFrom: number | null = null

    while (true) {
        const to = from + pageSize - 1
        const { data: profiles, error } = await supabase
            .from('telegram_profiles')
            .select('telegram_user_id, avatar_url')
            .order('telegram_user_id', { ascending: true })
            .range(from, to)
        if (error) {
            console.error('[telegram-location-bot] Ошибка чтения профилей для backfill', error)
            return new Response('Ошибка чтения профилей', { status: 500 })
        }
        if (!profiles || profiles.length === 0) break

        for (let idx = 0; idx < profiles.length; idx++) {
            if (processed >= maxProfilesPerRun) {
                nextResumeFrom = from + idx
                break
            }
            processed += 1
            const profile = profiles[idx]!
            const avatarUrl = typeof profile.avatar_url === 'string' ? profile.avatar_url : null
            if (isAvatarUrlSafe(avatarUrl)) {
                skippedSafe += 1
                continue
            }

            const refreshResult = await refreshTelegramAvatarUrl(profile.telegram_user_id, botToken)
            if (!refreshResult.ok) {
                if (refreshResult.reason === 'no_photo') {
                    skippedNoPhoto += 1
                } else {
                    failed += 1
                    failuresByReason[refreshResult.reason] = (failuresByReason[refreshResult.reason] ?? 0) + 1
                    if (errorSamples.length < BACKFILL_ERROR_SAMPLE_LIMIT) {
                        errorSamples.push({
                            telegram_user_id: profile.telegram_user_id,
                            reason: refreshResult.reason,
                        })
                    }
                    console.warn('[telegram-location-bot] Backfill avatar failed', {
                        telegram_user_id: profile.telegram_user_id,
                        reason: refreshResult.reason,
                    })
                }
                continue
            }

            const { error: updateError } = await supabase
                .from('telegram_profiles')
                .update({ avatar_url: refreshResult.avatarUrl })
                .eq('telegram_user_id', profile.telegram_user_id)
            if (updateError) {
                failed += 1
                failuresByReason.db_update_failed = (failuresByReason.db_update_failed ?? 0) + 1
                if (errorSamples.length < BACKFILL_ERROR_SAMPLE_LIMIT) {
                    errorSamples.push({
                        telegram_user_id: profile.telegram_user_id,
                        reason: 'db_update_failed',
                    })
                }
                console.warn('[telegram-location-bot] Backfill DB update failed', {
                    telegram_user_id: profile.telegram_user_id,
                    error: updateError,
                })
                continue
            }
            updated += 1
        }

        if (processed >= maxProfilesPerRun && nextResumeFrom === null && profiles.length === pageSize) {
            nextResumeFrom = from + pageSize
        }

        if (nextResumeFrom !== null) break
        if (profiles.length < pageSize) break
        if (processed >= maxProfilesPerRun) break
        from += pageSize
    }

    // Backfill считаем "capped" только когда есть куда продолжать (next_from задан).
    // Иначе при достижении лимита ровно на последней записи могло получаться:
    // capped_at_max_profiles=true и next_from=null.
    const capped = nextResumeFrom !== null

    return Response.json({
        ok: true,
        processed,
        updated,
        failed,
        skipped_safe: skippedSafe,
        skipped_no_photo: skippedNoPhoto,
        failures_by_reason: failuresByReason,
        error_samples: errorSamples,
        capped_at_max_profiles: capped,
        max_profiles_per_run: maxProfilesPerRun,
        start_offset: startOffset,
        next_from: nextResumeFrom,
    })
}

Deno.serve(async (req) => {
    const requestPath = new URL(req.url).pathname
    const isBackfillRequest = requestPath.endsWith('/backfill') || req.headers.get('x-telegram-avatar-backfill') === '1'

    console.info('[telegram-location-bot] Входящий запрос', {
        method: req.method,
        path: requestPath,
    })

    if (req.method !== 'POST') {
        console.warn('[telegram-location-bot] Отклонено: неподдерживаемый метод', {
            method: req.method,
        })
        return new Response('Method Not Allowed', { status: 405 })
    }

    if (isBackfillRequest) {
        return handleAvatarBackfill(req)
    }

    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    if (webhookSecret) {
        const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
        if (incomingSecret !== webhookSecret) {
            console.warn('[telegram-location-bot] Отклонено: неверный secret token')
            return new Response('Unauthorized', { status: 401 })
        }
    }

    let update: TelegramUpdate
    try {
        const rawBody = await req.text()
        if (!rawBody.trim()) {
            console.warn('[telegram-location-bot] Пустой JSON body')
            return new Response('Bad Request: empty JSON body', { status: 400 })
        }
        update = JSON.parse(rawBody) as TelegramUpdate
    } catch (error) {
        console.error('[telegram-location-bot] Ошибка парсинга JSON', error)
        return new Response('Bad Request', { status: 400 })
    }

    // console.info('[telegram-location-bot] Получен update', {
    //     update_id: update.update_id,
    // })

    const mapBaseUrl = Deno.env.get('MAP_BASE_URL') ?? 'https://map.euc.kz'
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    // Route inline queries
    if (update.inline_query) {
        if (botToken) {
            await handleInlineQuery(update.inline_query, botToken, mapBaseUrl)
        } else {
            console.warn('[telegram-location-bot] Inline query ignored: TELEGRAM_BOT_TOKEN not set')
        }
        return new Response('ok', { status: 200 })
    }

    // Route text commands
    const messageWithText = update.message || update.edited_message || update.channel_post || update.edited_channel_post
    if (messageWithText?.text?.trim().startsWith('/')) {
        if (botToken) {
            await handleCommand(messageWithText, botToken)
        } else {
            console.warn('[telegram-location-bot] Command ignored: TELEGRAM_BOT_TOKEN not set')
        }
        return new Response('ok', { status: 200 })
    }

    // Route location updates (existing behavior)
    const message = getMessageWithLocation(update)
    if (!message?.location || !message.from) {
        console.info('[telegram-location-bot] Update пропущен: нет location или from', {
            update_id: update.update_id,
            has_location: Boolean(message?.location),
            has_from: Boolean(message?.from),
        })
        return new Response('ok', { status: 200 })
    }

    // Only save live locations (not static point shares)
    if (!message.location.live_period || message.location.live_period <= 0) {
        console.info('[telegram-location-bot] Update пропущен: не живая геолокация', {
            update_id: update.update_id,
            live_period: message.location.live_period,
        })
        return new Response('ok', { status: 200 })
    }

    const { location } = message

    console.info('[telegram-location-bot] Сохраняем геопозицию', {
        update_id: update.update_id,
        chat_id: message.chat.id,
        telegram_user_id: message.from.id,
        latitude: location.latitude,
        longitude: location.longitude,
    })

    const telegramUserId = message.from.id
    const incomingUsername = message.from.username ?? null
    const incomingFirstName = message.from.first_name ?? null
    const incomingLastName = message.from.last_name ?? null

    const { data: existingProfile, error: profileFetchError } = await supabase
        .from('telegram_profiles')
        .select('telegram_user_id, username, first_name, last_name, avatar_url')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle<TelegramProfileRow>()

    if (profileFetchError) {
        console.error('[telegram-location-bot] Ошибка чтения telegram_profiles', {
            update_id: update.update_id,
            telegram_user_id: telegramUserId,
            error: profileFetchError,
        })
        return new Response('Internal Server Error', { status: 500 })
    }

    let avatarUrl = isAvatarUrlSafe(existingProfile?.avatar_url) ? (existingProfile?.avatar_url ?? null) : null
    if (!avatarUrl && botToken) {
        const refreshResult = await refreshTelegramAvatarUrl(telegramUserId, botToken)
        if (refreshResult.ok) {
            avatarUrl = refreshResult.avatarUrl
        }
    }

    const shouldUpdateProfile =
        !existingProfile ||
        existingProfile.username !== incomingUsername ||
        existingProfile.first_name !== incomingFirstName ||
        existingProfile.last_name !== incomingLastName ||
        (avatarUrl !== null && existingProfile.avatar_url !== avatarUrl)

    if (shouldUpdateProfile) {
        const { error: profileError } = await supabase.from('telegram_profiles').upsert(
            {
                telegram_user_id: telegramUserId,
                username: incomingUsername,
                first_name: incomingFirstName,
                last_name: incomingLastName,
                avatar_url: avatarUrl,
            },
            {
                onConflict: 'telegram_user_id',
            },
        )

        if (profileError) {
            console.error('[telegram-location-bot] Ошибка записи telegram_profiles', {
                update_id: update.update_id,
                telegram_user_id: telegramUserId,
                error: profileError,
            })
            return new Response('Internal Server Error', { status: 500 })
        }
    }

    const { error } = await supabase.from('telegram_locations').upsert(
        {
            telegram_update_id: update.update_id,
            chat_id: message.chat.id,
            chat_type: message.chat.type ?? null,
            chat_title: message.chat.title ?? null,
            message_id: message.message_id,
            telegram_user_id: message.from.id,
            username: message.from.username ?? null,
            first_name: message.from.first_name ?? null,
            last_name: message.from.last_name ?? null,
            longitude: location.longitude,
            latitude: location.latitude,
            location_accuracy_meters: location.horizontal_accuracy ?? null,
            location_live_period_seconds: location.live_period ?? null,
            location_heading: location.heading ?? null,
            location_proximity_alert_radius: location.proximity_alert_radius ?? null,
            raw_update: update,
        },
        {
            onConflict: 'telegram_update_id',
            ignoreDuplicates: true,
        },
    )

    if (error) {
        console.error('[telegram-location-bot] Ошибка записи telegram_locations', {
            update_id: update.update_id,
            chat_id: message.chat.id,
            telegram_user_id: message.from.id,
            error,
        })
        return new Response('Internal Server Error', { status: 500 })
    }

    return new Response('ok', { status: 200 })
})
