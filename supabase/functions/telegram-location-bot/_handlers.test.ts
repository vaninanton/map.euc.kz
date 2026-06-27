import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    callTelegramApi,
    handleAnnounceEventDate,
    handleAvatarBackfill,
    handleCallbackQuery,
    handleCancelAnnouncements,
    handleDeleteAnnouncements,
    handleEditAnnouncements,
    handlePinAnnouncement,
    handleAnnounceNews,
    handleEditNews,
    handleDeleteNews,
    isAdminRequest,
} from './_handlers.ts'
import type { TelegramCallbackQuery } from './_pure.ts'

// ───────────────────────────── fetch-мок для Telegram API ─────────────────────────────

type FetchCall = { url: string; body: unknown }

/**
 * Подменяет globalThis.fetch заданной функцией-ответчиком, собирает вызовы.
 * Возвращает restore() для возврата оригинала.
 */
function installFetchMock(responder: (url: string, body: unknown) => Response): {
    calls: FetchCall[]
    restore: () => void
} {
    const original = globalThis.fetch
    const calls: FetchCall[] = []
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        let body: unknown = null
        if (init?.body && typeof init.body === 'string') {
            try {
                body = JSON.parse(init.body)
            } catch {
                body = init.body
            }
        }
        calls.push({ url, body })
        return Promise.resolve(responder(url, body))
    }) as typeof fetch
    return { calls, restore: () => (globalThis.fetch = original) }
}

function tgOk(result: unknown = { message_id: 1 }): Response {
    return new Response(JSON.stringify({ ok: true, result }), { status: 200 })
}

/** Telegram-метод из URL: .../bot<token>/<method>. */
function methodOf(url: string): string {
    return url.split('/').pop() ?? ''
}

// ───────────────────────────── fake Supabase query builder ─────────────────────────────

type TableHandler = (op: string, state: QueryState) => { data?: unknown; error?: unknown; count?: number }

type QueryState = {
    table: string
    op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null
    payload?: unknown
    filters: Array<{ kind: string; col: string; val: unknown }>
    head?: boolean
}

/**
 * Минимальный фейк PostgREST-цепочки: from(table).select()/insert()/...eq()...maybeSingle().
 * Логику возврата задаёт handlers[table]. Записывает выполненные операции в opsLog.
 */
function makeFakeSupabase(
    handlers: Record<string, TableHandler>,
    opts: { adminUserId?: string } = {},
): {
    client: SupabaseClient
    opsLog: QueryState[]
} {
    const opsLog: QueryState[] = []

    function makeBuilder(table: string): unknown {
        const state: QueryState = { table, op: null, filters: [] }

        const resolve = () => {
            const handler = handlers[table]
            const result = handler ? handler(state.op ?? 'select', state) : { data: null, error: null }
            opsLog.push(state)
            return result
        }

        const builder: Record<string, unknown> = {
            select(_cols?: string, opts?: { count?: string; head?: boolean }) {
                state.op = state.op ?? 'select'
                if (opts?.head) state.head = true
                return builder
            },
            insert(payload: unknown) {
                state.op = 'insert'
                state.payload = payload
                return builder
            },
            update(payload: unknown) {
                state.op = 'update'
                state.payload = payload
                return builder
            },
            upsert(payload: unknown) {
                state.op = 'upsert'
                state.payload = payload
                return builder
            },
            delete() {
                state.op = 'delete'
                return builder
            },
            eq(col: string, val: unknown) {
                state.filters.push({ kind: 'eq', col, val })
                return builder
            },
            in(col: string, val: unknown) {
                state.filters.push({ kind: 'in', col, val })
                return builder
            },
            ilike(col: string, val: unknown) {
                state.filters.push({ kind: 'ilike', col, val })
                return builder
            },
            not(col: string, _op: string, val: unknown) {
                state.filters.push({ kind: 'not', col, val })
                return builder
            },
            is(col: string, val: unknown) {
                state.filters.push({ kind: 'is', col, val })
                return builder
            },
            order() {
                return builder
            },
            range() {
                return builder
            },
            limit() {
                return builder
            },
            maybeSingle() {
                return Promise.resolve(resolve())
            },
            single() {
                return Promise.resolve(resolve())
            },
            then(onfulfilled: (v: unknown) => unknown) {
                // await на самой цепочке (insert/update/delete/select без maybeSingle)
                return Promise.resolve(resolve()).then(onfulfilled)
            },
        }
        return builder
    }

    const client = {
        from: (table: string) => makeBuilder(table),
        auth: {
            getUser: (_jwt: string) =>
                Promise.resolve({
                    data: { user: opts.adminUserId ? { id: opts.adminUserId } : null },
                    error: null,
                }),
        },
        storage: {
            from: () => ({
                getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
                upload: () => Promise.resolve({ error: null }),
            }),
        },
    } as unknown as SupabaseClient

    return { client, opsLog }
}

// ───────────────────────────── callTelegramApi ─────────────────────────────

Deno.test('callTelegramApi: ok-ответ парсится, URL содержит метод и токен', async () => {
    const { calls, restore } = installFetchMock((url) => {
        assertEquals(url, 'https://api.telegram.org/botTOKEN/sendMessage')
        return tgOk({ message_id: 55 })
    })
    try {
        const res = await callTelegramApi('sendMessage', { chat_id: 1, text: 'hi' }, 'TOKEN')
        assertEquals(res.ok, true)
        assertEquals((res.result as { message_id: number }).message_id, 55)
        assertEquals(calls.length, 1)
        assertEquals((calls[0].body as { text: string }).text, 'hi')
    } finally {
        restore()
    }
})

Deno.test('callTelegramApi: HTTP-ошибка → { ok: false }', async () => {
    const { restore } = installFetchMock(() => new Response('boom', { status: 500 }))
    try {
        const res = await callTelegramApi('sendMessage', {}, 'TOKEN')
        assertEquals(res.ok, false)
    } finally {
        restore()
    }
})

Deno.test('callTelegramApi: HTTP 4xx с JSON-телом → сохраняет description (нужно для not found)', async () => {
    const { restore } = installFetchMock(
        () =>
            new Response(
                JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: message to edit not found' }),
                { status: 400 },
            ),
    )
    try {
        const res = await callTelegramApi('editMessageText', {}, 'TOKEN')
        assertEquals(res.ok, false)
        assertEquals(res.description, 'Bad Request: message to edit not found')
    } finally {
        restore()
    }
})

Deno.test('callTelegramApi: исключение fetch → { ok: false }', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (() => Promise.reject(new Error('network'))) as typeof fetch
    try {
        const res = await callTelegramApi('sendMessage', {}, 'TOKEN')
        assertEquals(res.ok, false)
    } finally {
        globalThis.fetch = original
    }
})

// ───────────────────────────── isAdminRequest ─────────────────────────────

Deno.test('isAdminRequest: нет Authorization → false', async () => {
    const { client } = makeFakeSupabase({})
    const req = new Request('https://x/announce', { method: 'POST' })
    assertEquals(await isAdminRequest(client, req), false)
})

Deno.test('isAdminRequest: валидный JWT + строка в map_admin_users → true', async () => {
    const client = {
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: 'u1' } }) }) }),
        }),
    } as unknown as SupabaseClient
    const req = new Request('https://x/announce', { method: 'POST', headers: { Authorization: 'Bearer jwt' } })
    assertEquals(await isAdminRequest(client, req), true)
})

Deno.test('isAdminRequest: JWT есть, но не админ → false', async () => {
    const client = {
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u2' } }, error: null }) },
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        }),
    } as unknown as SupabaseClient
    const req = new Request('https://x/announce', { method: 'POST', headers: { Authorization: 'Bearer jwt' } })
    assertEquals(await isAdminRequest(client, req), false)
})

// ───────────────────────────── handleCallbackQuery (RSVP toggle) ─────────────────────────────

const VALID_UUID = '11111111-2222-3333-4444-555555555555'

function makeCb(data: string | undefined): TelegramCallbackQuery {
    return {
        id: 'cbid',
        from: { id: 100, username: 'rider' },
        message: { message_id: 5, chat: { id: -200 } },
        data,
    }
}

Deno.test('handleCallbackQuery: мусорные data → answerCallbackQuery без записи', async () => {
    const { client, opsLog } = makeFakeSupabase({})
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        await handleCallbackQuery(client, makeCb('garbage'), 'TOKEN', 'https://map.euc.kz')
        assertEquals(opsLog.length, 0)
        assertEquals(calls.length, 1)
        assertEquals(methodOf(calls[0].url), 'answerCallbackQuery')
    } finally {
        restore()
    }
})

Deno.test('handleCallbackQuery: отменённая дата → тост «закрыта», без insert', async () => {
    const { client, opsLog } = makeFakeSupabase({
        map_event_dates: () => ({ data: { id: VALID_UUID, cancelled: true, event_id: 7 }, error: null }),
    })
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        await handleCallbackQuery(client, makeCb(`rsvp:${VALID_UUID}`), 'TOKEN', 'https://map.euc.kz')
        assertEquals(methodOf(calls[0].url), 'answerCallbackQuery')
        assertEquals((calls[0].body as { text: string }).text, 'Запись на эту дату закрыта')
        // запись участника не выполнялась
        assertEquals(
            opsLog.some((o) => o.table === 'map_event_participants'),
            false,
        )
    } finally {
        restore()
    }
})

Deno.test('handleCallbackQuery: новый участник → insert + тост + обновление ВСЕХ сообщений даты', async () => {
    const { client, opsLog } = makeFakeSupabase({
        map_event_dates: () => ({ data: { id: VALID_UUID, cancelled: false, event_id: 7 }, error: null }),
        telegram_profiles: () => ({ data: null, error: null }),
        map_event_participants: (op) => {
            if (op === 'select') return { data: null, error: null } // ещё не участвует
            if (op === 'insert') return { data: null, error: null }
            return { count: 1, error: null }
        },
        // дата разослана в два чата — обновить нужно оба сообщения
        telegram_outbound_messages: () => ({
            data: [
                { telegram_chat_id: -200, telegram_message_id: 42 },
                { telegram_chat_id: -300, telegram_message_id: 99 },
            ],
            error: null,
        }),
    })
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        await handleCallbackQuery(client, makeCb(`rsvp:${VALID_UUID}`), 'TOKEN', 'https://map.euc.kz')
        // был insert участника
        assertEquals(
            opsLog.some((o) => o.table === 'map_event_participants' && o.op === 'insert'),
            true,
        )
        const answer = calls.find((c) => methodOf(c.url) === 'answerCallbackQuery')!
        assertEquals((answer.body as { text: string }).text, 'Вы участвуете! 🛞')
        // обновлены оба сообщения (по одному editMessageReplyMarkup на чат)
        const edits = calls.filter((c) => methodOf(c.url) === 'editMessageReplyMarkup')
        assertEquals(edits.length, 2)
        assertEquals(
            edits.map((c) => (c.body as { message_id: number }).message_id).sort((a, b) => a - b),
            [42, 99],
        )
    } finally {
        restore()
    }
})

Deno.test(
    'handleCallbackQuery: сообщение удалено из чата → editMessageReplyMarkup not found → пометка deleted_at',
    async () => {
        const { client, opsLog } = makeFakeSupabase({
            map_event_dates: () => ({ data: { id: VALID_UUID, cancelled: false, event_id: 7 }, error: null }),
            telegram_profiles: () => ({ data: null, error: null }),
            map_event_participants: (op) => {
                if (op === 'select') return { data: null, error: null }
                if (op === 'insert') return { data: null, error: null }
                return { count: 1, error: null }
            },
            telegram_outbound_messages: (op) =>
                op === 'select'
                    ? { data: [{ id: 'a1', telegram_chat_id: -200, telegram_message_id: 42 }], error: null }
                    : { error: null },
        })
        const { restore } = installFetchMock((url) =>
            methodOf(url) === 'editMessageReplyMarkup'
                ? new Response(JSON.stringify({ ok: false, description: 'Bad Request: message to edit not found' }), {
                      status: 400,
                  })
                : tgOk(),
        )
        try {
            await handleCallbackQuery(client, makeCb(`rsvp:${VALID_UUID}`), 'TOKEN', 'https://map.euc.kz')
            // строка-«призрак» помечена deleted_at
            const updates = opsLog.filter((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')
            assertEquals(updates.length, 1)
            assertEquals(Object.prototype.hasOwnProperty.call(updates[0].payload, 'deleted_at'), true)
        } finally {
            restore()
        }
    },
)

Deno.test('handleCallbackQuery: уже участвует → delete + тост «больше не участвуете»', async () => {
    const { client, opsLog } = makeFakeSupabase({
        map_event_dates: () => ({ data: { id: VALID_UUID, cancelled: false, event_id: 7 }, error: null }),
        telegram_profiles: () => ({ data: null, error: null }),
        map_event_participants: (op) => {
            if (op === 'select') return { data: { id: 'part-1' }, error: null } // уже участвует
            return { count: 0, error: null }
        },
    })
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        await handleCallbackQuery(client, makeCb(`rsvp:${VALID_UUID}`), 'TOKEN', 'https://map.euc.kz')
        assertEquals(
            opsLog.some((o) => o.table === 'map_event_participants' && o.op === 'delete'),
            true,
        )
        const answer = calls.find((c) => methodOf(c.url) === 'answerCallbackQuery')!
        assertEquals((answer.body as { text: string }).text, 'Вы больше не участвуете')
    } finally {
        restore()
    }
})

// ───────────────────────────── handleAnnounceEventDate (pin) ─────────────────────────────

/** Запрос на /announce от админа с заданным телом. */
function announceReq(body: unknown): Request {
    return new Request('https://x/announce', {
        method: 'POST',
        headers: { Authorization: 'Bearer jwt', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
}

/** Набор table-handler'ов для успешного прохода анонса (без фото). */
function announceHandlers(): Record<string, TableHandler> {
    return {
        map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
        map_event_dates: () => ({
            data: {
                starts_at: '2026-07-14T19:00:00Z',
                event_id: 7,
                map_events: { id: 7, type: 'group_ride', title: 'T', location_text: null, photo_path: null },
            },
            error: null,
        }),
        telegram_chats: () => ({ data: [{ chat_id: -200 }], error: null }),
        map_event_participants: () => ({ count: 0, error: null }),
        // insert ... .select('id').single() → строка с id (нужно для последующего pin)
        telegram_outbound_messages: (op) =>
            op === 'insert' ? { data: { id: 'new-ann' }, error: null } : { data: null, error: null },
    }
}

Deno.test('handleAnnounceEventDate: pin=true → вызывает pinChatMessage, sent[].pinned=true', async () => {
    const { client } = makeFakeSupabase(announceHandlers(), { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk({ message_id: 42 }))
    try {
        const res = await handleAnnounceEventDate(
            client,
            announceReq({ event_date_id: VALID_UUID, destination_ids: ['dst-1'], pin: true }),
            'TOKEN',
            'https://map.euc.kz',
        )
        assertEquals(res.status, 200)
        const json = (await res.json()) as { sent: Array<{ chat_id: number; pinned?: boolean }> }
        assertEquals(json.sent.length, 1)
        assertEquals(json.sent[0].pinned, true)
        const pinCall = calls.find((c) => methodOf(c.url) === 'pinChatMessage')!
        assertEquals((pinCall.body as { message_id: number }).message_id, 42)
        assertEquals((pinCall.body as { disable_notification: boolean }).disable_notification, true)
    } finally {
        restore()
    }
})

Deno.test('handleAnnounceEventDate: чат с message_thread_id → sendMessage адресован в тему', async () => {
    const handlers: Record<string, TableHandler> = {
        ...announceHandlers(),
        telegram_chats: () => ({ data: [{ chat_id: -200, message_thread_id: 17 }], error: null }),
    }
    const { client } = makeFakeSupabase(handlers, { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk({ message_id: 42 }))
    try {
        await handleAnnounceEventDate(
            client,
            announceReq({ event_date_id: VALID_UUID, destination_ids: ['dst-1'], message_text: 'в тему' }),
            'TOKEN',
            'https://map.euc.kz',
        )
        const send = calls.find((c) => methodOf(c.url) === 'sendMessage')!
        assertEquals((send.body as { message_thread_id?: number }).message_thread_id, 17)
    } finally {
        restore()
    }
})

Deno.test('handleAnnounceEventDate: чат без темы (null) → message_thread_id не отправляется', async () => {
    const handlers: Record<string, TableHandler> = {
        ...announceHandlers(),
        telegram_chats: () => ({ data: [{ chat_id: -200, message_thread_id: null }], error: null }),
    }
    const { client } = makeFakeSupabase(handlers, { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk({ message_id: 42 }))
    try {
        await handleAnnounceEventDate(
            client,
            announceReq({ event_date_id: VALID_UUID, destination_ids: ['dst-1'], message_text: 'обычный' }),
            'TOKEN',
            'https://map.euc.kz',
        )
        const send = calls.find((c) => methodOf(c.url) === 'sendMessage')!
        assertEquals('message_thread_id' in (send.body as Record<string, unknown>), false)
    } finally {
        restore()
    }
})

Deno.test('handleAnnounceEventDate: сохраняет сырое body_text и photo_path в строку анонса', async () => {
    const { client, opsLog } = makeFakeSupabase(announceHandlers(), { adminUserId: 'admin-1' })
    const { restore } = installFetchMock(() => tgOk({ message_id: 42 }))
    try {
        await handleAnnounceEventDate(
            client,
            announceReq({ event_date_id: VALID_UUID, destination_ids: ['dst-1'], message_text: 'Сбор у фонтана' }),
            'TOKEN',
            'https://map.euc.kz',
        )
        const insert = opsLog.find((o) => o.table === 'telegram_outbound_messages' && o.op === 'insert')!
        const payload = insert.payload as { body_text: string; photo_path: string | null }
        assertEquals(payload.body_text, 'Сбор у фонтана')
        // в announceHandlers photo_path = null
        assertEquals(payload.photo_path, null)
    } finally {
        restore()
    }
})

Deno.test('handleAnnounceEventDate: pin не задан → pinChatMessage не вызывается, pinned отсутствует', async () => {
    const { client } = makeFakeSupabase(announceHandlers(), { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk({ message_id: 42 }))
    try {
        const res = await handleAnnounceEventDate(
            client,
            announceReq({ event_date_id: VALID_UUID, destination_ids: ['dst-1'] }),
            'TOKEN',
            'https://map.euc.kz',
        )
        const json = (await res.json()) as { sent: Array<{ pinned?: boolean }> }
        assertEquals(json.sent[0].pinned, undefined)
        assertEquals(
            calls.some((c) => methodOf(c.url) === 'pinChatMessage'),
            false,
        )
    } finally {
        restore()
    }
})

Deno.test(
    'handleAnnounceEventDate: pin=true, но закрепить нельзя → sent[].pinned=false, отправка не падает',
    async () => {
        const { client } = makeFakeSupabase(announceHandlers(), { adminUserId: 'admin-1' })
        // sendMessage ok, pinChatMessage — ошибка (нет прав)
        const { restore } = installFetchMock((url) =>
            methodOf(url) === 'pinChatMessage'
                ? new Response(JSON.stringify({ ok: false, description: 'not enough rights' }), { status: 400 })
                : tgOk({ message_id: 42 }),
        )
        try {
            const res = await handleAnnounceEventDate(
                client,
                announceReq({ event_date_id: VALID_UUID, destination_ids: ['dst-1'], pin: true }),
                'TOKEN',
                'https://map.euc.kz',
            )
            assertEquals(res.status, 200)
            const json = (await res.json()) as { sent: Array<{ pinned?: boolean }>; failed: unknown[] }
            assertEquals(json.sent[0].pinned, false)
            assertEquals(json.failed.length, 0)
        } finally {
            restore()
        }
    },
)

// ───────────────────────────── handleCancelAnnouncements ─────────────────────────────

Deno.test('handleCancelAnnouncements: не админ → 401', async () => {
    const { client } = makeFakeSupabase({})
    const req = new Request('https://x/announce-cancel', { method: 'POST' })
    const res = await handleCancelAnnouncements(client, req, 'TOKEN')
    assertEquals(res.status, 401)
})

Deno.test('handleCancelAnnouncements: невалидный event_date_id → 400', async () => {
    const client = {
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: 'u1' } }) }) }),
        }),
    } as unknown as SupabaseClient
    const req = new Request('https://x/announce-cancel', {
        method: 'POST',
        headers: { Authorization: 'Bearer jwt', 'content-type': 'application/json' },
        body: JSON.stringify({ event_date_id: 'not-uuid' }),
    })
    const res = await handleCancelAnnouncements(client, req, 'TOKEN')
    assertEquals(res.status, 400)
})

// ───────────────────────── handleEditAnnouncements / handleDeleteAnnouncements ─────────────────────────

/** Админский запрос на произвольный announce-сабрут. */
function adminAnnounceReq(path: string, body: unknown): Request {
    return new Request(`https://x/${path}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer jwt', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
}

/** Handler'ы для edit/delete: админ, контекст даты, два живых сообщения в разных чатах. */
function editDeleteHandlers(): Record<string, TableHandler> {
    return {
        map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
        map_event_dates: () => ({
            data: {
                starts_at: '2026-07-14T19:00:00Z',
                event_id: 7,
                map_events: { id: 7, type: 'group_ride', title: 'T', location_text: null, photo_path: null },
            },
            error: null,
        }),
        map_event_participants: () => ({ count: 0, error: null }),
        telegram_outbound_messages: (op) =>
            op === 'select'
                ? {
                      data: [
                          {
                              id: 'a1',
                              telegram_chat_id: -200,
                              telegram_message_id: 42,
                              message_text: 'старый',
                              photo_path: null,
                          },
                          {
                              id: 'a2',
                              telegram_chat_id: -300,
                              telegram_message_id: 99,
                              message_text: 'старый',
                              photo_path: null,
                          },
                      ],
                      error: null,
                  }
                : { error: null },
    }
}

Deno.test('handleEditAnnouncements: правит текст во всех сообщениях + сохраняет снимок в БД', async () => {
    const { client, opsLog } = makeFakeSupabase(editDeleteHandlers(), { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        const res = await handleEditAnnouncements(
            client,
            adminAnnounceReq('announce-edit', { event_date_id: VALID_UUID, message_text: 'новый текст' }),
            'TOKEN',
            'https://map.euc.kz',
        )
        assertEquals(res.status, 200)
        const json = (await res.json()) as { edited: number; failed: unknown[] }
        assertEquals(json.edited, 2)
        assertEquals(json.failed.length, 0)

        const edits = calls.filter((c) => methodOf(c.url) === 'editMessageText')
        assertEquals(edits.length, 2)
        // новый текст содержит свободное тело и не равен старому снимку
        assertEquals((edits[0].body as { text: string }).text.includes('новый текст'), true)
        // снимок текста обновлён в БД по каждой строке: message_text (со шапкой) + сырое body_text
        const updates = opsLog.filter((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')
        assertEquals(updates.length, 2)
        const payload = updates[0].payload as { message_text: string; body_text: string }
        assertEquals(payload.body_text, 'новый текст')
        assertEquals(payload.message_text.includes('новый текст'), true)
    } finally {
        restore()
    }
})

Deno.test(
    'handleEditAnnouncements: фото-сообщение (photo_path) → editMessageCaption, без editMessageText',
    async () => {
        // Строки с photo_path → редактируются как подпись (детерминированно по типу, без пробного вызова).
        const handlers: Record<string, TableHandler> = {
            ...editDeleteHandlers(),
            telegram_outbound_messages: (op) =>
                op === 'select'
                    ? {
                          data: [
                              {
                                  id: 'a1',
                                  telegram_chat_id: -200,
                                  telegram_message_id: 42,
                                  message_text: 'старый',
                                  photo_path: 'events/7/a.jpg',
                              },
                              {
                                  id: 'a2',
                                  telegram_chat_id: -300,
                                  telegram_message_id: 99,
                                  message_text: 'старый',
                                  photo_path: 'events/7/b.jpg',
                              },
                          ],
                          error: null,
                      }
                    : { error: null },
        }
        const { client } = makeFakeSupabase(handlers, { adminUserId: 'admin-1' })
        const { calls, restore } = installFetchMock(() => tgOk())
        try {
            const res = await handleEditAnnouncements(
                client,
                adminAnnounceReq('announce-edit', { event_date_id: VALID_UUID, message_text: 'новый' }),
                'TOKEN',
                'https://map.euc.kz',
            )
            const json = (await res.json()) as { edited: number }
            assertEquals(json.edited, 2)
            assertEquals(calls.filter((c) => methodOf(c.url) === 'editMessageCaption').length, 2)
            assertEquals(calls.filter((c) => methodOf(c.url) === 'editMessageText').length, 0)
        } finally {
            restore()
        }
    },
)

Deno.test('handleEditAnnouncements: сообщение удалено из чата (not found) → failed + пометка deleted_at', async () => {
    const { client, opsLog } = makeFakeSupabase(editDeleteHandlers(), { adminUserId: 'admin-1' })
    // Оба editMessageText отвечают «message to edit not found».
    const { restore } = installFetchMock((url) =>
        methodOf(url) === 'editMessageText'
            ? new Response(JSON.stringify({ ok: false, description: 'Bad Request: message to edit not found' }), {
                  status: 400,
              })
            : tgOk(),
    )
    try {
        const res = await handleEditAnnouncements(
            client,
            adminAnnounceReq('announce-edit', { event_date_id: VALID_UUID, message_text: 'новый' }),
            'TOKEN',
            'https://map.euc.kz',
        )
        const json = (await res.json()) as { edited: number; failed: unknown[] }
        assertEquals(json.edited, 0)
        assertEquals(json.failed.length, 2)
        // обе строки помечены deleted_at (самоочищение из живых)
        const updates = opsLog.filter((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')
        assertEquals(updates.length, 2)
        assertEquals(Object.prototype.hasOwnProperty.call(updates[0].payload, 'deleted_at'), true)
    } finally {
        restore()
    }
})

Deno.test('handleEditAnnouncements: невалидный event_date_id → 400', async () => {
    const { client } = makeFakeSupabase(editDeleteHandlers(), { adminUserId: 'admin-1' })
    const res = await handleEditAnnouncements(
        client,
        adminAnnounceReq('announce-edit', { event_date_id: 'nope', message_text: 'x' }),
        'TOKEN',
        'https://map.euc.kz',
    )
    assertEquals(res.status, 400)
})

Deno.test('handleEditAnnouncements: не админ → 401', async () => {
    const { client } = makeFakeSupabase({})
    const res = await handleEditAnnouncements(
        client,
        new Request('https://x/announce-edit', { method: 'POST' }),
        'TOKEN',
        'https://map.euc.kz',
    )
    assertEquals(res.status, 401)
})

Deno.test('handleDeleteAnnouncements: deleteMessage во всех чатах + пометка deleted_at', async () => {
    const { client, opsLog } = makeFakeSupabase(editDeleteHandlers(), { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        const res = await handleDeleteAnnouncements(
            client,
            adminAnnounceReq('announce-delete', { event_date_id: VALID_UUID }),
            'TOKEN',
        )
        assertEquals(res.status, 200)
        const json = (await res.json()) as { deleted: number }
        assertEquals(json.deleted, 2)
        assertEquals(calls.filter((c) => methodOf(c.url) === 'deleteMessage').length, 2)
        // обе строки помечены deleted_at
        const updates = opsLog.filter((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')
        assertEquals(updates.length, 2)
        assertEquals(Object.prototype.hasOwnProperty.call(updates[0].payload, 'deleted_at'), true)
    } finally {
        restore()
    }
})

Deno.test('handleDeleteAnnouncements: deleteMessage упал → строка всё равно помечается deleted_at', async () => {
    const { client, opsLog } = makeFakeSupabase(editDeleteHandlers(), { adminUserId: 'admin-1' })
    const { restore } = installFetchMock(
        () => new Response(JSON.stringify({ ok: false, description: 'message to delete not found' }), { status: 400 }),
    )
    try {
        const res = await handleDeleteAnnouncements(
            client,
            adminAnnounceReq('announce-delete', { event_date_id: VALID_UUID }),
            'TOKEN',
        )
        const json = (await res.json()) as { deleted: number }
        assertEquals(json.deleted, 2)
        assertEquals(opsLog.filter((o) => o.table === 'telegram_outbound_messages' && o.op === 'update').length, 2)
    } finally {
        restore()
    }
})

Deno.test('handleDeleteAnnouncements: не админ → 401', async () => {
    const { client } = makeFakeSupabase({})
    const res = await handleDeleteAnnouncements(
        client,
        new Request('https://x/announce-delete', { method: 'POST' }),
        'TOKEN',
    )
    assertEquals(res.status, 401)
})

// ───────────────────────────── handlePinAnnouncement ─────────────────────────────

const PIN_ANN_ID = '99999999-2222-3333-4444-555555555555'

/** Handler'ы для pin: админ + живая строка анонса. */
function pinHandlers(): Record<string, TableHandler> {
    return {
        map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
        telegram_outbound_messages: (op) =>
            op === 'select'
                ? { data: { id: PIN_ANN_ID, telegram_chat_id: -200, telegram_message_id: 42 }, error: null }
                : { error: null },
    }
}

Deno.test('handlePinAnnouncement: pin=true → pinChatMessage + update pinned_at', async () => {
    const { client, opsLog } = makeFakeSupabase(pinHandlers(), { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        const res = await handlePinAnnouncement(
            client,
            adminAnnounceReq('announce-pin', { announcement_id: PIN_ANN_ID, pin: true }),
            'TOKEN',
        )
        assertEquals(res.status, 200)
        const json = (await res.json()) as { ok: boolean; pinned: boolean }
        assertEquals(json.pinned, true)
        assertEquals(
            calls.some((c) => methodOf(c.url) === 'pinChatMessage'),
            true,
        )
        const upd = opsLog.find((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')!
        assertEquals(typeof (upd.payload as { pinned_at: unknown }).pinned_at, 'string')
    } finally {
        restore()
    }
})

Deno.test('handlePinAnnouncement: pin=false → unpinChatMessage + pinned_at=null', async () => {
    const { client, opsLog } = makeFakeSupabase(pinHandlers(), { adminUserId: 'admin-1' })
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        const res = await handlePinAnnouncement(
            client,
            adminAnnounceReq('announce-pin', { announcement_id: PIN_ANN_ID, pin: false }),
            'TOKEN',
        )
        const json = (await res.json()) as { pinned: boolean }
        assertEquals(json.pinned, false)
        assertEquals(
            calls.some((c) => methodOf(c.url) === 'unpinChatMessage'),
            true,
        )
        const upd = opsLog.find((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')!
        assertEquals((upd.payload as { pinned_at: unknown }).pinned_at, null)
    } finally {
        restore()
    }
})

Deno.test('handlePinAnnouncement: Telegram отказал → 502, pinned_at не меняется', async () => {
    const { client, opsLog } = makeFakeSupabase(pinHandlers(), { adminUserId: 'admin-1' })
    const { restore } = installFetchMock(
        () => new Response(JSON.stringify({ ok: false, description: 'not enough rights' }), { status: 400 }),
    )
    try {
        const res = await handlePinAnnouncement(
            client,
            adminAnnounceReq('announce-pin', { announcement_id: PIN_ANN_ID, pin: true }),
            'TOKEN',
        )
        assertEquals(res.status, 502)
        assertEquals(
            opsLog.some((o) => o.table === 'telegram_outbound_messages' && o.op === 'update'),
            false,
        )
    } finally {
        restore()
    }
})

Deno.test('handlePinAnnouncement: строки нет (удалена/чужая) → 404', async () => {
    const { client } = makeFakeSupabase(
        {
            map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
            telegram_outbound_messages: () => ({ data: null, error: null }),
        },
        { adminUserId: 'admin-1' },
    )
    const res = await handlePinAnnouncement(
        client,
        adminAnnounceReq('announce-pin', { announcement_id: PIN_ANN_ID, pin: true }),
        'TOKEN',
    )
    assertEquals(res.status, 404)
})

Deno.test('handlePinAnnouncement: невалидный ввод → 400', async () => {
    const { client } = makeFakeSupabase(pinHandlers(), { adminUserId: 'admin-1' })
    const res = await handlePinAnnouncement(
        client,
        adminAnnounceReq('announce-pin', { announcement_id: 'nope', pin: true }),
        'TOKEN',
    )
    assertEquals(res.status, 400)
})

Deno.test('handlePinAnnouncement: не админ → 401', async () => {
    const { client } = makeFakeSupabase({})
    const res = await handlePinAnnouncement(client, new Request('https://x/announce-pin', { method: 'POST' }), 'TOKEN')
    assertEquals(res.status, 401)
})

// ───────────────────────────── handleAvatarBackfill ─────────────────────────────

Deno.test('handleAvatarBackfill: нет TELEGRAM_BACKFILL_SECRET → 503', async () => {
    const { client } = makeFakeSupabase({})
    const req = new Request('https://x/backfill', { method: 'POST' })
    const res = await handleAvatarBackfill(client, req, { botToken: 'T' })
    assertEquals(res.status, 503)
})

Deno.test('handleAvatarBackfill: неверный secret → 401', async () => {
    const { client } = makeFakeSupabase({})
    const req = new Request('https://x/backfill', {
        method: 'POST',
        headers: { 'x-telegram-backfill-secret': 'WRONG' },
    })
    const res = await handleAvatarBackfill(client, req, { backfillSecret: 'RIGHT', botToken: 'T' })
    assertEquals(res.status, 401)
})

Deno.test('handleAvatarBackfill: пустая таблица → ok, processed=0', async () => {
    const { client } = makeFakeSupabase({
        telegram_profiles: () => ({ data: [], error: null }),
    })
    const req = new Request('https://x/backfill', {
        method: 'POST',
        headers: { 'x-telegram-backfill-secret': 'S' },
    })
    const res = await handleAvatarBackfill(client, req, { backfillSecret: 'S', botToken: 'T' })
    assertEquals(res.status, 200)
    const json = (await res.json()) as { ok: boolean; processed: number; capped_at_max_profiles: boolean }
    assertEquals(json.ok, true)
    assertEquals(json.processed, 0)
    assertEquals(json.capped_at_max_profiles, false)
})

Deno.test('handleAvatarBackfill: безопасные URL пропускаются (skipped_safe)', async () => {
    let page = 0
    const { client } = makeFakeSupabase({
        telegram_profiles: () => {
            page += 1
            // первая страница — две записи с безопасными URL, дальше пусто
            if (page === 1) {
                return {
                    data: [
                        { telegram_user_id: 1, avatar_url: 'https://cdn/telegram-avatars/1/avatar.jpg' },
                        { telegram_user_id: 2, avatar_url: 'https://cdn/telegram-avatars/2/avatar.jpg' },
                    ],
                    error: null,
                }
            }
            return { data: [], error: null }
        },
    })
    const req = new Request('https://x/backfill', {
        method: 'POST',
        headers: { 'x-telegram-backfill-secret': 'S' },
    })
    const res = await handleAvatarBackfill(client, req, { backfillSecret: 'S', botToken: 'T' })
    const json = (await res.json()) as { processed: number; skipped_safe: number; updated: number }
    assertEquals(json.processed, 2)
    assertEquals(json.skipped_safe, 2)
    assertEquals(json.updated, 0)
})

// ───────────────────────────── Новости проекта ─────────────────────────────

/** Запрос на /news-* от админа с заданным телом. */
function newsReq(body: unknown): Request {
    return new Request('https://x/news-announce', {
        method: 'POST',
        headers: { Authorization: 'Bearer jwt', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
}

Deno.test('handleAnnounceNews: шлёт sendMessage в выбранные чаты и пишет строку с news_id', async () => {
    const { client, opsLog } = makeFakeSupabase(
        {
            map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
            map_news: () => ({ data: { body: 'Привет', photo_path: null, deleted_at: null }, error: null }),
            telegram_chats: () => ({ data: [{ chat_id: -200, message_thread_id: null }], error: null }),
            telegram_outbound_messages: () => ({ data: null, error: null }),
        },
        { adminUserId: 'admin-1' },
    )
    const { calls, restore } = installFetchMock(() => tgOk({ message_id: 77 }))
    try {
        const res = await handleAnnounceNews(client, newsReq({ news_id: VALID_UUID, destination_ids: ['d1'] }), 'TOKEN')
        const json = (await res.json()) as { sent: Array<{ chat_id: number; message_id: number }>; failed: unknown[] }
        assertEquals(json.sent, [{ chat_id: -200, message_id: 77 }])
        assertEquals(json.failed.length, 0)
        assertEquals(methodOf(calls[0].url), 'sendMessage')
        const insert = opsLog.find((o) => o.table === 'telegram_outbound_messages' && o.op === 'insert')!
        assertEquals((insert.payload as { news_id: string }).news_id, VALID_UUID)
        assertEquals((insert.payload as { telegram_message_id: number }).telegram_message_id, 77)
    } finally {
        restore()
    }
})

Deno.test('handleAnnounceNews: фото у новости → sendPhoto с caption', async () => {
    const { client } = makeFakeSupabase(
        {
            map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
            map_news: () => ({ data: { body: 'Текст', photo_path: 'n/1.jpg', deleted_at: null }, error: null }),
            telegram_chats: () => ({ data: [{ chat_id: -200, message_thread_id: null }], error: null }),
            telegram_outbound_messages: () => ({ data: null, error: null }),
        },
        { adminUserId: 'admin-1' },
    )
    const { calls, restore } = installFetchMock(() => tgOk({ message_id: 5 }))
    try {
        await handleAnnounceNews(client, newsReq({ news_id: VALID_UUID, destination_ids: ['d1'] }), 'TOKEN')
        assertEquals(methodOf(calls[0].url), 'sendPhoto')
        assertEquals((calls[0].body as { caption: string }).caption, 'Текст')
    } finally {
        restore()
    }
})

Deno.test('handleAnnounceNews: пустое тело → 400 empty_body', async () => {
    const { client } = makeFakeSupabase(
        {
            map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
            map_news: () => ({ data: { body: '   ', photo_path: null, deleted_at: null }, error: null }),
        },
        { adminUserId: 'admin-1' },
    )
    const res = await handleAnnounceNews(client, newsReq({ news_id: VALID_UUID, destination_ids: ['d1'] }), 'TOKEN')
    assertEquals(res.status, 400)
    assertEquals(((await res.json()) as { error: string }).error, 'empty_body')
})

Deno.test('handleAnnounceNews: удалённая новость → 404 news_not_found', async () => {
    const { client } = makeFakeSupabase(
        {
            map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
            map_news: () => ({
                data: { body: 'x', photo_path: null, deleted_at: '2026-01-01T00:00:00Z' },
                error: null,
            }),
        },
        { adminUserId: 'admin-1' },
    )
    const res = await handleAnnounceNews(client, newsReq({ news_id: VALID_UUID, destination_ids: ['d1'] }), 'TOKEN')
    assertEquals(res.status, 404)
})

Deno.test('handleEditNews: editMessageText во всех живых + обновление body_text', async () => {
    const { client, opsLog } = makeFakeSupabase(
        {
            map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
            map_news: () => ({ data: { body: 'Новый текст', photo_path: null, deleted_at: null }, error: null }),
            telegram_outbound_messages: (op) =>
                op === 'select'
                    ? {
                          data: [
                              { id: 'a1', telegram_chat_id: -200, telegram_message_id: 11, photo_path: null },
                              { id: 'a2', telegram_chat_id: -300, telegram_message_id: 22, photo_path: null },
                          ],
                          error: null,
                      }
                    : { error: null },
        },
        { adminUserId: 'admin-1' },
    )
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        const res = await handleEditNews(client, newsReq({ news_id: VALID_UUID }), 'TOKEN')
        const json = (await res.json()) as { edited: number; failed: unknown[] }
        assertEquals(json.edited, 2)
        assertEquals(json.failed.length, 0)
        assertEquals(calls.filter((c) => methodOf(c.url) === 'editMessageText').length, 2)
        const updates = opsLog.filter((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')
        assertEquals(updates.length, 2)
        assertEquals((updates[0].payload as { body_text: string }).body_text, 'Новый текст')
    } finally {
        restore()
    }
})

Deno.test('handleDeleteNews: deleteMessage + пометка deleted_at для каждого живого', async () => {
    const { client, opsLog } = makeFakeSupabase(
        {
            map_admin_users: () => ({ data: { user_id: 'admin-1' }, error: null }),
            telegram_outbound_messages: (op) =>
                op === 'select'
                    ? {
                          data: [{ id: 'a1', telegram_chat_id: -200, telegram_message_id: 11, photo_path: null }],
                          error: null,
                      }
                    : { error: null },
        },
        { adminUserId: 'admin-1' },
    )
    const { calls, restore } = installFetchMock(() => tgOk())
    try {
        const res = await handleDeleteNews(client, newsReq({ news_id: VALID_UUID }), 'TOKEN')
        assertEquals(((await res.json()) as { deleted: number }).deleted, 1)
        assertEquals(calls.filter((c) => methodOf(c.url) === 'deleteMessage').length, 1)
        const updates = opsLog.filter((o) => o.table === 'telegram_outbound_messages' && o.op === 'update')
        assertEquals(Object.prototype.hasOwnProperty.call(updates[0].payload, 'deleted_at'), true)
    } finally {
        restore()
    }
})

Deno.test('handleAnnounceNews: не админ → 401', async () => {
    const { client } = makeFakeSupabase({})
    const res = await handleAnnounceNews(client, newsReq({ news_id: VALID_UUID, destination_ids: ['d1'] }), 'TOKEN')
    assertEquals(res.status, 401)
})
