import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getMessageWithLocation, type TelegramUpdate } from './_pure.ts'
import {
    CORS_HEADERS,
    handleAnnounceEventDate,
    handleAvatarBackfill,
    handleCallbackQuery,
    handleCancelAnnouncements,
    handleCommand,
    handleDeleteAnnouncements,
    handleEditAnnouncements,
    handlePinAnnouncement,
    handleInlineQuery,
    handleLocationUpdate,
    jsonWithCors,
} from './_handlers.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Отсутствуют SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

Deno.serve(async (req) => {
    const requestPath = new URL(req.url).pathname
    const isBackfillRequest = requestPath.endsWith('/backfill') || req.headers.get('x-telegram-avatar-backfill') === '1'

    console.info('[telegram-location-bot] Входящий запрос', {
        method: req.method,
        path: requestPath,
    })

    const isAnnounceRoute =
        requestPath.endsWith('/announce') ||
        requestPath.endsWith('/announce-cancel') ||
        requestPath.endsWith('/announce-edit') ||
        requestPath.endsWith('/announce-delete') ||
        requestPath.endsWith('/announce-pin')

    // CORS preflight для сабрутов админки (functions.invoke шлёт OPTIONS перед POST).
    if (req.method === 'OPTIONS' && isAnnounceRoute) {
        return new Response('ok', { status: 200, headers: CORS_HEADERS })
    }

    // Сабруты для админки (авторизация — JWT администратора, не secret-токен вебхука).
    // Маршрутизируются до проверки method !== POST, иначе браузерный preflight упёрся бы в 405.
    if (isAnnounceRoute) {
        if (req.method !== 'POST') return jsonWithCors({ error: 'method_not_allowed' }, 405)
        const announceMapBaseUrl = Deno.env.get('MAP_BASE_URL') ?? 'https://map.euc.kz'
        const announceBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
        if (requestPath.endsWith('/announce-cancel')) {
            return handleCancelAnnouncements(supabase, req, announceBotToken)
        }
        if (requestPath.endsWith('/announce-edit')) {
            return handleEditAnnouncements(supabase, req, announceBotToken, announceMapBaseUrl)
        }
        if (requestPath.endsWith('/announce-delete')) {
            return handleDeleteAnnouncements(supabase, req, announceBotToken)
        }
        if (requestPath.endsWith('/announce-pin')) {
            return handlePinAnnouncement(supabase, req, announceBotToken)
        }
        return handleAnnounceEventDate(supabase, req, announceBotToken, announceMapBaseUrl)
    }

    if (req.method !== 'POST') {
        console.warn('[telegram-location-bot] Отклонено: неподдерживаемый метод', {
            method: req.method,
        })
        return new Response('Method Not Allowed', { status: 405 })
    }

    if (isBackfillRequest) {
        return handleAvatarBackfill(supabase, req, {
            backfillSecret: Deno.env.get('TELEGRAM_BACKFILL_SECRET'),
            botToken: Deno.env.get('TELEGRAM_BOT_TOKEN'),
            maxProfilesRaw: Deno.env.get('TELEGRAM_BACKFILL_MAX_PROFILES'),
        })
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

    const mapBaseUrl = Deno.env.get('MAP_BASE_URL') ?? 'https://map.euc.kz'
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    // Route inline queries
    if (update.inline_query) {
        if (botToken) {
            await handleInlineQuery(supabase, update.inline_query, botToken, mapBaseUrl, supabaseUrl)
        } else {
            console.warn('[telegram-location-bot] Inline query ignored: TELEGRAM_BOT_TOKEN not set')
        }
        return new Response('ok', { status: 200 })
    }

    // Route callback queries (нажатие инлайн-кнопки «Участвую»)
    if (update.callback_query) {
        if (botToken) {
            await handleCallbackQuery(supabase, update.callback_query, botToken, mapBaseUrl)
        } else {
            console.warn('[telegram-location-bot] Callback query ignored: TELEGRAM_BOT_TOKEN not set')
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

    return handleLocationUpdate(supabase, update, message, botToken)
})
