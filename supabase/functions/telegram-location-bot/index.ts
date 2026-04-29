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
    location?: TelegramLocation
}

type TelegramUpdate = {
    update_id: number
    message?: TelegramMessage
    edited_message?: TelegramMessage
    channel_post?: TelegramMessage
    edited_channel_post?: TelegramMessage
}

type TelegramProfileRow = {
    telegram_user_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
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

Deno.serve(async (req) => {
    const requestPath = new URL(req.url).pathname

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
        update = (await req.json()) as TelegramUpdate
    } catch (error) {
        console.error('[telegram-location-bot] Ошибка парсинга JSON', error)
        return new Response('Bad Request', { status: 400 })
    }

    // console.info('[telegram-location-bot] Получен update', {
    //     update_id: update.update_id,
    // })

    const message = getMessageWithLocation(update)
    if (!message?.location || !message.from) {
        console.info('[telegram-location-bot] Update пропущен: нет location или from', {
            update_id: update.update_id,
            has_location: Boolean(message?.location),
            has_from: Boolean(message?.from),
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

    const avatarUrl = existingProfile?.avatar_url ?? null

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
