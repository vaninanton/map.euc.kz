/**
 * Обработчики telegram-location-bot с I/O (Supabase + Telegram API).
 *
 * Supabase-клиент инъектируется параметром — это позволяет в тестах подменять
 * его фейком, а Telegram API мокается через globalThis.fetch.
 * Здесь НЕТ Deno.serve и чтения env на уровне модуля — точка входа в index.ts.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    BACKFILL_ERROR_SAMPLE_LIMIT,
    DEFAULT_BACKFILL_MAX_PROFILES_PER_RUN,
    TELEGRAM_AVATARS_BUCKET,
    UUID_RE,
    buildAnnouncementText,
    buildCancelledAnnouncementText,
    buildNewsText,
    buildRsvpKeyboard,
    isAvatarUrlSafe,
    parsePositiveIntEnv,
    parseRsvpCallbackData,
    type AnnouncementEvent,
    type EventTypeValue,
    type TelegramCallbackQuery,
    type TelegramInlineQuery,
    type TelegramInlineQueryResultArticle,
    type TelegramInlineQueryResultPhoto,
    type TelegramMessage,
    type TelegramUser,
} from './_pure.ts'

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

export type AvatarRefreshResult =
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

/** CORS-заголовки для сабрутов, вызываемых из браузера (админка через functions.invoke). */
export const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Ответ JSON с CORS-заголовками. */
export function jsonWithCors(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
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
    supabase: SupabaseClient,
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

export async function refreshTelegramAvatarUrl(
    supabase: SupabaseClient,
    userId: number,
    botToken: string,
): Promise<AvatarRefreshResult> {
    try {
        const filePathResult = await resolveTelegramAvatarFilePath(userId, botToken)
        if (!filePathResult.ok) {
            return { ok: false, reason: filePathResult.reason }
        }
        const uploadResult = await uploadTelegramAvatarToStorage(supabase, userId, filePathResult.filePath, botToken)
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
 * Generic helper для вызова Telegram Bot API методов.
 * POST {method} с JSON body, возвращает распарсенный результат.
 */
export async function callTelegramApi(
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

        // Тело Telegram-ошибки — валидный JSON { ok:false, error_code, description } даже при HTTP 4xx.
        // Парсим его и при !response.ok, иначе теряем description (нужен для распознавания «message not found»).
        const payload = (await response.json().catch(() => ({ ok: false }))) as {
            ok: boolean
            result?: unknown
            error_code?: number
            description?: string
        }
        if (!response.ok) {
            console.error('[telegram-location-bot] Telegram API error', {
                method,
                status: response.status,
                description: payload.description,
            })
            return { ok: false, error_code: payload.error_code, description: payload.description }
        }

        return payload
    } catch (error) {
        console.error('[telegram-location-bot] callTelegramApi exception', {
            method,
            error,
        })
        return { ok: false }
    }
}

// ───────────────────────────── Анонсы событий + RSVP ─────────────────────────────

/** Текущее число участников даты. */
export async function countEventParticipants(supabase: SupabaseClient, eventDateId: string): Promise<number> {
    const { count, error } = await supabase
        .from('map_event_participants')
        .select('id', { count: 'exact', head: true })
        .eq('event_date_id', eventDateId)
    if (error) {
        console.error('[telegram-location-bot] countEventParticipants', error)
        return 0
    }
    return count ?? 0
}

/**
 * Гарантирует наличие строки telegram_profiles для пользователя (по telegram_user_id).
 * Для RSVP-пути аватар не запрашиваем (refreshAvatar=false) — answerCallbackQuery
 * должен успеть в коротком окне callback'а; аватары добьёт /backfill.
 */
export async function ensureTelegramProfile(supabase: SupabaseClient, user: TelegramUser): Promise<void> {
    const { error } = await supabase.from('telegram_profiles').upsert(
        {
            telegram_user_id: user.id,
            username: user.username ?? null,
            first_name: user.first_name ?? null,
            last_name: user.last_name ?? null,
        },
        { onConflict: 'telegram_user_id' },
    )
    if (error) {
        console.error('[telegram-location-bot] ensureTelegramProfile', { telegram_user_id: user.id, error })
        throw error
    }
}

/**
 * Обрабатывает нажатие инлайн-кнопки «Участвую» (toggle): записывает/убирает участника,
 * отвечает тостом и редактирует клавиатуру сообщения, обновляя счётчик.
 */
export async function handleCallbackQuery(
    supabase: SupabaseClient,
    cb: TelegramCallbackQuery,
    botToken: string,
    mapBaseUrl: string,
): Promise<void> {
    const parsed = parseRsvpCallbackData(cb.data)
    if (!parsed) {
        await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id }, botToken)
        return
    }
    const eventDateId = parsed.eventDateId

    // Дата должна существовать и быть не отменённой.
    const { data: dateRow, error: dateError } = await supabase
        .from('map_event_dates')
        .select('id, cancelled, event_id')
        .eq('id', eventDateId)
        .maybeSingle<{ id: string; cancelled: boolean; event_id: number }>()
    if (dateError || !dateRow || dateRow.cancelled) {
        await callTelegramApi(
            'answerCallbackQuery',
            { callback_query_id: cb.id, text: 'Запись на эту дату закрыта' },
            botToken,
        )
        return
    }

    try {
        await ensureTelegramProfile(supabase, cb.from)
    } catch {
        await callTelegramApi(
            'answerCallbackQuery',
            { callback_query_id: cb.id, text: 'Не удалось сохранить запись, попробуйте позже' },
            botToken,
        )
        return
    }

    // Toggle: есть строка — удаляем, нет — добавляем.
    const { data: existing } = await supabase
        .from('map_event_participants')
        .select('id')
        .eq('event_date_id', eventDateId)
        .eq('telegram_user_id', cb.from.id)
        .maybeSingle<{ id: string }>()

    let toastText: string
    if (existing) {
        await supabase.from('map_event_participants').delete().eq('id', existing.id)
        toastText = 'Вы больше не участвуете'
    } else {
        const { error: insertError } = await supabase
            .from('map_event_participants')
            .insert({ event_date_id: eventDateId, telegram_user_id: cb.from.id })
        // 23505 — гонка: уже записан, считаем идемпотентным успехом.
        toastText =
            insertError && insertError.code !== '23505'
                ? 'Не удалось записаться, попробуйте позже'
                : 'Вы участвуете! 🛞'
    }

    const count = await countEventParticipants(supabase, eventDateId)
    await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id, text: toastText }, botToken)

    // Счётчик участников привязан к дате, а не к одному сообщению: дата могла быть
    // разослана в несколько чатов. Обновляем клавиатуру во ВСЕХ живых анонсах даты,
    // иначе число в кнопке разойдётся между чатами.
    await refreshAnnouncementKeyboards(supabase, eventDateId, dateRow.event_id, count, mapBaseUrl, botToken)
}

type LiveAnnouncement = {
    id: string
    telegram_chat_id: number
    telegram_message_id: number
    message_text: string
    photo_path: string | null
}

/**
 * Живые исходящие сообщения по родителю (event_date_id или news_id): отправленные
 * (telegram_message_id), не отменённые и не удалённые. Единый источник для обновления
 * счётчика (RSVP), отмены, правки текста и удаления.
 * photo_path определяет тип сообщения (фото → caption, иначе → text) при редактировании.
 */
async function listLiveAnnouncements(
    supabase: SupabaseClient,
    parentColumn: 'event_date_id' | 'news_id',
    parentId: string,
): Promise<LiveAnnouncement[]> {
    const { data } = await supabase
        .from('telegram_outbound_messages')
        .select('id, telegram_chat_id, telegram_message_id, message_text, photo_path')
        .eq(parentColumn, parentId)
        .not('telegram_message_id', 'is', null)
        .is('cancelled_at', null)
        .is('deleted_at', null)
    return (data ?? []) as LiveAnnouncement[]
}

/**
 * Сообщение пропало из чата (удалено вручную/чат недоступен): Telegram отвечает
 * «message to edit/delete not found», «message can't be edited», «MESSAGE_ID_INVALID».
 * Такой анонс больше не редактируем — помечаем deleted_at, чтобы он выбыл из живых.
 */
function isMessageGoneError(description: string | undefined): boolean {
    const d = (description ?? '').toLowerCase()
    return d.includes('not found') || d.includes("can't be edited") || d.includes('message_id_invalid')
}

/** Помечает строку анонса как удалённую — самоочищение «призраков» из listLiveAnnouncements. */
async function markOutboundDeleted(supabase: SupabaseClient, id: string): Promise<void> {
    await supabase.from('telegram_outbound_messages').update({ deleted_at: new Date().toISOString() }).eq('id', id)
}

/**
 * Закрепляет/открепляет сообщение анонса в чате и синхронизирует pinned_at в БД.
 * Best-effort: если Telegram отказал (нет прав, сообщение удалено) — pinned_at не меняем.
 * disable_notification=true при закреплении — чтобы не было пуша поверх анонса.
 * Возвращает ok и новое состояние pinned (для ответа клиенту).
 */
async function setAnnouncementPinned(
    supabase: SupabaseClient,
    row: { id: string; telegram_chat_id: number; telegram_message_id: number },
    pin: boolean,
    botToken: string,
): Promise<{ ok: boolean; pinned: boolean; description?: string }> {
    const result = pin
        ? await callTelegramApi(
              'pinChatMessage',
              { chat_id: row.telegram_chat_id, message_id: row.telegram_message_id, disable_notification: true },
              botToken,
          )
        : await callTelegramApi(
              'unpinChatMessage',
              { chat_id: row.telegram_chat_id, message_id: row.telegram_message_id },
              botToken,
          )
    if (!result.ok) {
        console.warn('[telegram-location-bot] pin/unpin не удалось', {
            chat_id: row.telegram_chat_id,
            message_id: row.telegram_message_id,
            pin,
            description: result.description,
        })
        return { ok: false, pinned: !pin, description: result.description }
    }
    await supabase
        .from('telegram_outbound_messages')
        .update({ pinned_at: pin ? new Date().toISOString() : null })
        .eq('id', row.id)
    return { ok: true, pinned: pin }
}

/**
 * Редактирует текст/подпись отправленного анонса с учётом его типа:
 * фото-сообщение (photo_path) → editMessageCaption, иначе → editMessageText.
 * Единый примитив для правки и отмены — без пробного вызова с фолбэком.
 */
async function editAnnouncementContent(
    row: Pick<LiveAnnouncement, 'telegram_chat_id' | 'telegram_message_id' | 'photo_path'>,
    text: string,
    botToken: string,
    replyMarkup?: { inline_keyboard: unknown[] },
): Promise<{ ok: boolean; description?: string }> {
    const base = { chat_id: row.telegram_chat_id, message_id: row.telegram_message_id, parse_mode: 'HTML' as const }
    return row.photo_path
        ? await callTelegramApi('editMessageCaption', { ...base, caption: text, reply_markup: replyMarkup }, botToken)
        : await callTelegramApi(
              'editMessageText',
              { ...base, text, disable_web_page_preview: true, reply_markup: replyMarkup },
              botToken,
          )
}

/**
 * Обновляет клавиатуру (счётчик «Участвую (N)») во всех живых анонсах даты.
 * Дата могла быть разослана в несколько чатов — обновляем каждый.
 * Ошибки отдельных editMessageReplyMarkup безвредны («message is not modified» и т.п.).
 */
async function refreshAnnouncementKeyboards(
    supabase: SupabaseClient,
    eventDateId: string,
    eventId: number,
    count: number,
    mapBaseUrl: string,
    botToken: string,
): Promise<void> {
    const rows = await listLiveAnnouncements(supabase, 'event_date_id', eventDateId)
    const keyboard = buildRsvpKeyboard(eventDateId, count, mapBaseUrl, eventId)
    for (const row of rows) {
        const editResult = await callTelegramApi(
            'editMessageReplyMarkup',
            {
                chat_id: row.telegram_chat_id,
                message_id: row.telegram_message_id,
                reply_markup: keyboard,
            },
            botToken,
        )
        if (!editResult.ok) {
            console.info('[telegram-location-bot] editMessageReplyMarkup пропущен', {
                chat_id: row.telegram_chat_id,
                message_id: row.telegram_message_id,
                description: editResult.description,
            })
            // Сообщение удалено из чата → выводим анонс из живых, чтобы не дёргать его впредь.
            if (isMessageGoneError(editResult.description)) await markOutboundDeleted(supabase, row.id)
        }
    }
}

/**
 * Проверяет, что запрос исходит от администратора (Authorization: Bearer <jwt>).
 * Возвращает true, если user.id присутствует в map_admin_users.
 */
export async function isAdminRequest(supabase: SupabaseClient, req: Request): Promise<boolean> {
    const authHeader = req.headers.get('Authorization')
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!jwt) return false
    const { data, error } = await supabase.auth.getUser(jwt)
    if (error || !data.user) return false
    const { data: adminRow } = await supabase
        .from('map_admin_users')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle<{ user_id: string }>()
    return Boolean(adminRow)
}

/**
 * Общий guard сабрутов /announce-*: проверяет админа, наличие bot-токена, парсит JSON
 * и валидирует event_date_id (UUID). Возвращает распарсенное тело либо готовый error-Response.
 */
async function requireAnnounceRequest(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<{ body: Record<string, unknown>; eventDateId: string; botToken: string } | Response> {
    if (!(await isAdminRequest(supabase, req))) return jsonWithCors({ error: 'unauthorized' }, 401)
    if (!botToken) return jsonWithCors({ error: 'no_bot_token' }, 500)

    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return jsonWithCors({ error: 'bad_request' }, 400)
    }
    const eventDateId = body.event_date_id
    if (typeof eventDateId !== 'string' || !UUID_RE.test(eventDateId)) {
        return jsonWithCors({ error: 'invalid_input' }, 400)
    }
    return { body, eventDateId, botToken }
}

/** Загружает событие + дату для анонса. */
async function loadAnnouncementContext(
    supabase: SupabaseClient,
    eventDateId: string,
): Promise<{ event: AnnouncementEvent; eventId: number; photoPath: string | null; startsAt: string } | null> {
    const { data, error } = await supabase
        .from('map_event_dates')
        .select('starts_at, event_id, map_events(id, type, title, location_text, photo_path)')
        .eq('id', eventDateId)
        .maybeSingle<{
            starts_at: string
            event_id: number
            map_events: {
                id: number
                type: EventTypeValue
                title: string
                location_text: string | null
                photo_path: string | null
            } | null
        }>()
    if (error || !data || !data.map_events) return null
    const ev = data.map_events
    return {
        event: { id: ev.id, type: ev.type, title: ev.title, location_text: ev.location_text },
        eventId: ev.id,
        photoPath: ev.photo_path,
        startsAt: data.starts_at,
    }
}

/** Публичный URL фото события. */
function eventPhotoPublicUrl(supabase: SupabaseClient, photoPath: string): string {
    return supabase.storage.from('map-event-photos').getPublicUrl(photoPath).data.publicUrl
}

/**
 * Сабрут /announce: отправляет анонс даты в выбранные чаты с кнопкой «Участвую».
 * Авторизация — JWT администратора (functions.invoke прикладывает заголовок).
 */
export async function handleAnnounceEventDate(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
    mapBaseUrl: string,
): Promise<Response> {
    const guard = await requireAnnounceRequest(supabase, req, botToken)
    if (guard instanceof Response) return guard
    const { body, eventDateId, botToken: token } = guard
    // destination_ids — суррогатные id назначений (чат+тема); один chat_id может встречаться несколько раз.
    const destinationIds = body.destination_ids
    if (
        !Array.isArray(destinationIds) ||
        destinationIds.length === 0 ||
        !destinationIds.every((d) => typeof d === 'string')
    ) {
        return jsonWithCors({ error: 'invalid_input' }, 400)
    }
    const pin = body.pin === true

    const ctx = await loadAnnouncementContext(supabase, eventDateId)
    if (!ctx) return jsonWithCors({ error: 'date_not_found' }, 404)

    // Только переданные назначения, которые есть в telegram_chats и enabled.
    // message_thread_id — тема форумной группы (NULL для обычных чатов).
    const { data: chatRows } = await supabase
        .from('telegram_chats')
        .select('chat_id, message_thread_id')
        .eq('enabled', true)
        .in('id', destinationIds)
    const validChats = (chatRows ?? []) as Array<{ chat_id: number; message_thread_id: number | null }>
    if (validChats.length === 0) return jsonWithCors({ error: 'no_valid_chats' }, 400)

    const count = await countEventParticipants(supabase, eventDateId)
    // bodyText — сырое тело админа (источник истины для правки); text — итог со шапкой для Telegram.
    const bodyText = typeof body.message_text === 'string' ? body.message_text : ''
    const text = buildAnnouncementText(ctx.event, ctx.startsAt, bodyText)
    const keyboard = buildRsvpKeyboard(eventDateId, count, mapBaseUrl, ctx.eventId)
    const photoUrl = ctx.photoPath ? eventPhotoPublicUrl(supabase, ctx.photoPath) : null

    const sent: Array<{ chat_id: number; message_id: number; pinned?: boolean }> = []
    const failed: Array<{ chat_id: number; error: string }> = []

    for (const { chat_id: chatId, message_thread_id: threadId } of validChats) {
        // В форумных группах сообщение адресуется в тему; для обычных чатов ключ не шлём.
        const thread = typeof threadId === 'number' ? { message_thread_id: threadId } : {}
        const apiResult = photoUrl
            ? await callTelegramApi(
                  'sendPhoto',
                  {
                      chat_id: chatId,
                      ...thread,
                      photo: photoUrl,
                      caption: text,
                      parse_mode: 'HTML',
                      reply_markup: keyboard,
                  },
                  token,
              )
            : await callTelegramApi(
                  'sendMessage',
                  {
                      chat_id: chatId,
                      ...thread,
                      text,
                      parse_mode: 'HTML',
                      disable_web_page_preview: true,
                      reply_markup: keyboard,
                  },
                  token,
              )

        const messageId =
            apiResult.ok && apiResult.result && typeof apiResult.result === 'object'
                ? ((apiResult.result as { message_id?: number }).message_id ?? null)
                : null

        if (apiResult.ok && messageId !== null) {
            const { data: inserted } = await supabase
                .from('telegram_outbound_messages')
                .insert({
                    event_date_id: eventDateId,
                    telegram_chat_id: chatId,
                    message_thread_id: threadId,
                    telegram_message_id: messageId,
                    message_text: text,
                    body_text: bodyText,
                    photo_path: ctx.photoPath,
                    sent_at: new Date().toISOString(),
                })
                .select('id')
                .single<{ id: string }>()

            // Закрепление best-effort: ошибка не валит отправку (бот может не иметь права закреплять).
            let pinned: boolean | undefined
            if (pin && inserted) {
                const r = await setAnnouncementPinned(
                    supabase,
                    { id: inserted.id, telegram_chat_id: chatId, telegram_message_id: messageId },
                    true,
                    token,
                )
                pinned = r.pinned
            }

            sent.push(
                pin ? { chat_id: chatId, message_id: messageId, pinned } : { chat_id: chatId, message_id: messageId },
            )
        } else {
            const errText = apiResult.description ?? 'send_failed'
            await supabase.from('telegram_outbound_messages').insert({
                event_date_id: eventDateId,
                telegram_chat_id: chatId,
                message_thread_id: threadId,
                message_text: text,
                body_text: bodyText,
                photo_path: ctx.photoPath,
                send_error: errText,
            })
            failed.push({ chat_id: chatId, error: errText })
        }
    }

    return jsonWithCors({ sent, failed }, 200)
}

/**
 * Сабрут /announce-cancel: помечает все анонсы даты как отменённые
 * (редактирует сообщения в «❌ ОТМЕНЕНО», убирает кнопку «Участвую»).
 */
export async function handleCancelAnnouncements(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<Response> {
    const guard = await requireAnnounceRequest(supabase, req, botToken)
    if (guard instanceof Response) return guard
    const { eventDateId, botToken: token } = guard

    const rows = await listLiveAnnouncements(supabase, 'event_date_id', eventDateId)

    let cancelled = 0
    for (const r of rows) {
        const newText = buildCancelledAnnouncementText(r.message_text)
        await editAnnouncementContent(r, newText, token)
        await callTelegramApi(
            'editMessageReplyMarkup',
            { chat_id: r.telegram_chat_id, message_id: r.telegram_message_id, reply_markup: { inline_keyboard: [] } },
            token,
        )
        await supabase
            .from('telegram_outbound_messages')
            .update({ cancelled_at: new Date().toISOString() })
            .eq('id', r.id)
        cancelled += 1
    }

    return jsonWithCors({ cancelled }, 200)
}

/**
 * Сабрут /announce-edit: меняет текст во ВСЕХ живых анонсах даты.
 * Принимает новое тело (свободный текст админа); шапка (тип · название · дата)
 * перестраивается автоматически — как при первой отправке. Кнопка «Участвую» сохраняется.
 */
export async function handleEditAnnouncements(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
    mapBaseUrl: string,
): Promise<Response> {
    const guard = await requireAnnounceRequest(supabase, req, botToken)
    if (guard instanceof Response) return guard
    const { body, eventDateId, botToken: token } = guard

    const ctx = await loadAnnouncementContext(supabase, eventDateId)
    if (!ctx) return jsonWithCors({ error: 'date_not_found' }, 404)

    const bodyText = typeof body.message_text === 'string' ? body.message_text : ''
    const text = buildAnnouncementText(ctx.event, ctx.startsAt, bodyText)
    const count = await countEventParticipants(supabase, eventDateId)
    const keyboard = buildRsvpKeyboard(eventDateId, count, mapBaseUrl, ctx.eventId)
    const rows = await listLiveAnnouncements(supabase, 'event_date_id', eventDateId)

    let edited = 0
    const failed: Array<{ chat_id: number; error: string }> = []
    for (const r of rows) {
        const editResult = await editAnnouncementContent(r, text, token, keyboard)

        if (editResult.ok) {
            await supabase
                .from('telegram_outbound_messages')
                .update({ message_text: text, body_text: bodyText })
                .eq('id', r.id)
            edited += 1
        } else {
            failed.push({ chat_id: r.telegram_chat_id, error: editResult.description ?? 'edit_failed' })
            // Сообщение удалено из чата → выводим из живых (иначе «призрак» вечно в failed).
            if (isMessageGoneError(editResult.description)) await markOutboundDeleted(supabase, r.id)
        }
    }

    return jsonWithCors({ edited, failed }, 200)
}

/**
 * Сабрут /announce-delete: удаляет сообщения анонса из Telegram (deleteMessage)
 * и помечает строки deleted_at. Строки остаются в БД для истории.
 */
export async function handleDeleteAnnouncements(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<Response> {
    const guard = await requireAnnounceRequest(supabase, req, botToken)
    if (guard instanceof Response) return guard
    const { eventDateId, botToken: token } = guard

    const rows = await listLiveAnnouncements(supabase, 'event_date_id', eventDateId)

    let deleted = 0
    for (const r of rows) {
        // Telegram возвращает ok=true даже если сообщение уже удалено — считаем успехом.
        const delResult = await callTelegramApi(
            'deleteMessage',
            { chat_id: r.telegram_chat_id, message_id: r.telegram_message_id },
            token,
        )
        if (!delResult.ok) {
            console.info('[telegram-location-bot] deleteMessage пропущен', {
                chat_id: r.telegram_chat_id,
                message_id: r.telegram_message_id,
                description: delResult.description,
            })
        }
        await supabase
            .from('telegram_outbound_messages')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', r.id)
        deleted += 1
    }

    return jsonWithCors({ deleted }, 200)
}

/**
 * Сабрут /announce-pin: закрепляет/открепляет ОДНО сообщение анонса (по announcement_id).
 * Body: { announcement_id: uuid, pin: boolean }. Возвращает { ok, pinned }.
 */
export async function handlePinAnnouncement(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<Response> {
    if (!(await isAdminRequest(supabase, req))) return jsonWithCors({ error: 'unauthorized' }, 401)
    if (!botToken) return jsonWithCors({ error: 'no_bot_token' }, 500)

    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return jsonWithCors({ error: 'bad_request' }, 400)
    }
    const announcementId = body.announcement_id
    if (typeof announcementId !== 'string' || !UUID_RE.test(announcementId) || typeof body.pin !== 'boolean') {
        return jsonWithCors({ error: 'invalid_input' }, 400)
    }

    // Только живое (отправленное, не отменённое/удалённое) сообщение можно (от)закрепить.
    const { data: row } = await supabase
        .from('telegram_outbound_messages')
        .select('id, telegram_chat_id, telegram_message_id')
        .eq('id', announcementId)
        .not('telegram_message_id', 'is', null)
        .is('cancelled_at', null)
        .is('deleted_at', null)
        .maybeSingle<{ id: string; telegram_chat_id: number; telegram_message_id: number }>()
    if (!row) return jsonWithCors({ error: 'not_found' }, 404)

    const result = await setAnnouncementPinned(supabase, row, body.pin, botToken)
    if (!result.ok) return jsonWithCors({ error: 'telegram_failed', description: result.description }, 502)
    return jsonWithCors({ ok: true, pinned: result.pinned }, 200)
}

// ───────────────────────────── Новости проекта ─────────────────────────────

/**
 * Общий guard сабрутов /news-*: проверяет админа, наличие bot-токена, парсит JSON
 * и валидирует news_id (UUID). Возвращает распарсенное тело либо готовый error-Response.
 */
async function requireNewsRequest(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<{ body: Record<string, unknown>; newsId: string; botToken: string } | Response> {
    if (!(await isAdminRequest(supabase, req))) return jsonWithCors({ error: 'unauthorized' }, 401)
    if (!botToken) return jsonWithCors({ error: 'no_bot_token' }, 500)

    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return jsonWithCors({ error: 'bad_request' }, 400)
    }
    const newsId = body.news_id
    if (typeof newsId !== 'string' || !UUID_RE.test(newsId)) {
        return jsonWithCors({ error: 'invalid_input' }, 400)
    }
    return { body, newsId, botToken }
}

/** Загружает новость (тело + фото) для отправки/правки. */
async function loadNewsContext(
    supabase: SupabaseClient,
    newsId: string,
): Promise<{ body: string; photoPath: string | null } | null> {
    const { data, error } = await supabase
        .from('map_news')
        .select('body, photo_path, deleted_at')
        .eq('id', newsId)
        .maybeSingle<{ body: string; photo_path: string | null; deleted_at: string | null }>()
    if (error || !data || data.deleted_at !== null) return null
    return { body: data.body, photoPath: data.photo_path }
}

/** Публичный URL фото новости. */
function newsPhotoPublicUrl(supabase: SupabaseClient, photoPath: string): string {
    return supabase.storage.from('map-news-photos').getPublicUrl(photoPath).data.publicUrl
}

/**
 * Сабрут /news-announce: отправляет новость в выбранные чаты (sendMessage/sendPhoto).
 * Body: { news_id: uuid, destination_ids: string[] }. Авторизация — JWT администратора.
 */
export async function handleAnnounceNews(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<Response> {
    const guard = await requireNewsRequest(supabase, req, botToken)
    if (guard instanceof Response) return guard
    const { body, newsId, botToken: token } = guard
    // destination_ids — суррогатные id назначений (чат+тема); один chat_id может встречаться несколько раз.
    const destinationIds = body.destination_ids
    if (
        !Array.isArray(destinationIds) ||
        destinationIds.length === 0 ||
        !destinationIds.every((d) => typeof d === 'string')
    ) {
        return jsonWithCors({ error: 'invalid_input' }, 400)
    }

    const ctx = await loadNewsContext(supabase, newsId)
    if (!ctx) return jsonWithCors({ error: 'news_not_found' }, 404)
    if (ctx.body.trim().length === 0) return jsonWithCors({ error: 'empty_body' }, 400)

    // Только переданные назначения, которые есть в telegram_chats и enabled.
    const { data: chatRows } = await supabase
        .from('telegram_chats')
        .select('chat_id, message_thread_id')
        .eq('enabled', true)
        .in('id', destinationIds)
    const validChats = (chatRows ?? []) as Array<{ chat_id: number; message_thread_id: number | null }>
    if (validChats.length === 0) return jsonWithCors({ error: 'no_valid_chats' }, 400)

    const text = buildNewsText(ctx.body)
    const photoUrl = ctx.photoPath ? newsPhotoPublicUrl(supabase, ctx.photoPath) : null

    const sent: Array<{ chat_id: number; message_id: number }> = []
    const failed: Array<{ chat_id: number; error: string }> = []

    for (const { chat_id: chatId, message_thread_id: threadId } of validChats) {
        // В форумных группах сообщение адресуется в тему; для обычных чатов ключ не шлём.
        const thread = typeof threadId === 'number' ? { message_thread_id: threadId } : {}
        const apiResult = photoUrl
            ? await callTelegramApi(
                  'sendPhoto',
                  { chat_id: chatId, ...thread, photo: photoUrl, caption: text, parse_mode: 'HTML' },
                  token,
              )
            : await callTelegramApi(
                  'sendMessage',
                  { chat_id: chatId, ...thread, text, parse_mode: 'HTML', disable_web_page_preview: true },
                  token,
              )

        const messageId =
            apiResult.ok && apiResult.result && typeof apiResult.result === 'object'
                ? ((apiResult.result as { message_id?: number }).message_id ?? null)
                : null

        if (apiResult.ok && messageId !== null) {
            await supabase.from('telegram_outbound_messages').insert({
                news_id: newsId,
                telegram_chat_id: chatId,
                message_thread_id: threadId,
                telegram_message_id: messageId,
                message_text: text,
                body_text: ctx.body,
                photo_path: ctx.photoPath,
                sent_at: new Date().toISOString(),
            })
            sent.push({ chat_id: chatId, message_id: messageId })
        } else {
            const errText = apiResult.description ?? 'send_failed'
            await supabase.from('telegram_outbound_messages').insert({
                news_id: newsId,
                telegram_chat_id: chatId,
                message_thread_id: threadId,
                message_text: text,
                body_text: ctx.body,
                photo_path: ctx.photoPath,
                send_error: errText,
            })
            failed.push({ chat_id: chatId, error: errText })
        }
    }

    return jsonWithCors({ sent, failed }, 200)
}

/**
 * Сабрут /news-announce-edit: меняет текст во ВСЕХ живых сообщениях новости.
 * Берёт актуальное тело из map_news (источник истины). Body: { news_id: uuid }.
 */
export async function handleEditNews(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<Response> {
    const guard = await requireNewsRequest(supabase, req, botToken)
    if (guard instanceof Response) return guard
    const { newsId, botToken: token } = guard

    const ctx = await loadNewsContext(supabase, newsId)
    if (!ctx) return jsonWithCors({ error: 'news_not_found' }, 404)

    const text = buildNewsText(ctx.body)
    const rows = await listLiveAnnouncements(supabase, 'news_id', newsId)

    let edited = 0
    const failed: Array<{ chat_id: number; error: string }> = []
    for (const r of rows) {
        const editResult = await editAnnouncementContent(r, text, token)
        if (editResult.ok) {
            await supabase
                .from('telegram_outbound_messages')
                .update({ message_text: text, body_text: ctx.body })
                .eq('id', r.id)
            edited += 1
        } else {
            failed.push({ chat_id: r.telegram_chat_id, error: editResult.description ?? 'edit_failed' })
            // Сообщение удалено из чата → выводим из живых, иначе «призрак» вечно в failed.
            if (isMessageGoneError(editResult.description)) await markOutboundDeleted(supabase, r.id)
        }
    }

    return jsonWithCors({ edited, failed }, 200)
}

/**
 * Сабрут /news-announce-delete: удаляет сообщения новости из Telegram (deleteMessage)
 * и помечает строки deleted_at. Строки остаются в БД для истории. Body: { news_id: uuid }.
 */
export async function handleDeleteNews(
    supabase: SupabaseClient,
    req: Request,
    botToken: string | undefined,
): Promise<Response> {
    const guard = await requireNewsRequest(supabase, req, botToken)
    if (guard instanceof Response) return guard
    const { newsId, botToken: token } = guard

    const rows = await listLiveAnnouncements(supabase, 'news_id', newsId)

    let deleted = 0
    for (const r of rows) {
        // Telegram возвращает ok=true даже если сообщение уже удалено — считаем успехом.
        const delResult = await callTelegramApi(
            'deleteMessage',
            { chat_id: r.telegram_chat_id, message_id: r.telegram_message_id },
            token,
        )
        if (!delResult.ok) {
            console.info('[telegram-location-bot] deleteMessage (news) пропущен', {
                chat_id: r.telegram_chat_id,
                message_id: r.telegram_message_id,
                description: delResult.description,
            })
        }
        await markOutboundDeleted(supabase, r.id)
        deleted += 1
    }

    return jsonWithCors({ deleted }, 200)
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Handles Telegram commands (e.g., /start).
 */
export async function handleCommand(message: TelegramMessage, botToken: string): Promise<void> {
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
export async function handleInlineQuery(
    supabase: SupabaseClient,
    inlineQuery: TelegramInlineQuery,
    botToken: string,
    mapBaseUrl: string,
    supabaseUrlForPhotos: string,
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
        const pointIds = allPoints.map((p: { id: number }) => p.id)

        const photosByPointId: Record<number, string> = {}
        if (pointIds.length > 0) {
            const { data: photos } = await supabase
                .from('map_point_photos')
                .select('point_id, bucket_name, storage_path')
                .in('point_id', pointIds)
                .order('sort_order')
                .limit(pointIds.length)

            if (photos) {
                for (const photo of photos as Array<{ point_id: number; bucket_name: string; storage_path: string }>) {
                    const pointId = photo.point_id
                    if (!photosByPointId[pointId]) {
                        const publicUrl = `${supabaseUrlForPhotos}/storage/v1/object/public/${photo.bucket_name}/${encodeURIComponent(photo.storage_path)}`
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
export async function handleAvatarBackfill(
    supabase: SupabaseClient,
    req: Request,
    env: { backfillSecret?: string; botToken?: string; maxProfilesRaw?: string },
): Promise<Response> {
    const backfillSecret = env.backfillSecret
    if (!backfillSecret || !backfillSecret.trim()) {
        console.error('[telegram-location-bot] Backfill отключён: не задан TELEGRAM_BACKFILL_SECRET')
        return new Response('TELEGRAM_BACKFILL_SECRET не настроен', { status: 503 })
    }
    const incomingBackfill = req.headers.get('x-telegram-backfill-secret')
    if (incomingBackfill !== backfillSecret) {
        console.warn('[telegram-location-bot] Backfill отклонён: неверный x-telegram-backfill-secret')
        return new Response('Unauthorized', { status: 401 })
    }

    const botToken = env.botToken
    if (!botToken) {
        return new Response('TELEGRAM_BOT_TOKEN не задан', { status: 500 })
    }

    const maxProfilesPerRun = parsePositiveIntEnv(env.maxProfilesRaw, DEFAULT_BACKFILL_MAX_PROFILES_PER_RUN)

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

            const refreshResult = await refreshTelegramAvatarUrl(supabase, profile.telegram_user_id, botToken)
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

/**
 * Сохраняет live-геопозицию из сообщения: обновляет профиль (с аватаром при необходимости)
 * и вставляет строку в telegram_locations. Возвращает HTTP Response для вебхука.
 */
export async function handleLocationUpdate(
    supabase: SupabaseClient,
    update: { update_id: number },
    message: TelegramMessage,
    botToken: string | undefined,
): Promise<Response> {
    const location = message.location!
    const from = message.from!

    console.info('[telegram-location-bot] Сохраняем геопозицию', {
        update_id: update.update_id,
        chat_id: message.chat.id,
        telegram_user_id: from.id,
        latitude: location.latitude,
        longitude: location.longitude,
    })

    const telegramUserId = from.id
    const incomingUsername = from.username ?? null
    const incomingFirstName = from.first_name ?? null
    const incomingLastName = from.last_name ?? null

    const { data: existingProfile, error: profileFetchError } = await supabase
        .from('telegram_profiles')
        .select('telegram_user_id, username, first_name, last_name, avatar_url')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle<{
            telegram_user_id: number
            username: string | null
            first_name: string | null
            last_name: string | null
            avatar_url: string | null
        }>()

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
        const refreshResult = await refreshTelegramAvatarUrl(supabase, telegramUserId, botToken)
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
            telegram_user_id: from.id,
            username: from.username ?? null,
            first_name: from.first_name ?? null,
            last_name: from.last_name ?? null,
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
            telegram_user_id: from.id,
            error,
        })
        return new Response('Internal Server Error', { status: 500 })
    }

    return new Response('ok', { status: 200 })
}
