import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildAiAssistPrompt, extractResponsesOutputText, parseAiAssistEntity, parseAiSuggestion } from './_pure.ts'

/** CORS-заголовки: функция вызывается из браузера админки через functions.invoke. */
const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonWithCors(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
}

/**
 * Проверяет, что запрос исходит от администратора (Authorization: Bearer <jwt>).
 * Возвращает true, если user.id присутствует в map_admin_users.
 */
async function isAdminRequest(supabase: SupabaseClient, req: Request): Promise<boolean> {
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

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Отсутствуют SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') return jsonWithCors({ error: 'method_not_allowed' }, 405)

    if (!(await isAdminRequest(supabase, req))) return jsonWithCors({ error: 'unauthorized' }, 401)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
        console.error('[ai-assist] OPENAI_API_KEY не задан')
        return jsonWithCors({ error: 'no_api_key' }, 500)
    }

    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return jsonWithCors({ error: 'bad_request' }, 400)
    }

    const entity = parseAiAssistEntity(body.entity)
    if (!entity) return jsonWithCors({ error: 'invalid_input' }, 400)

    // Флаг web-поиска: по умолчанию включён, выключается чекбоксом в админке.
    const webSearch = body.webSearch !== false
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini'
    const prompt = buildAiAssistPrompt(entity, { webSearch })

    // Responses API; с web_search модель проверяет факты и ищет точки интереса
    // в интернете (медленнее). JSON-формат не форсируем (конфликтует с поиском) —
    // parseAiSuggestion устойчив к markdown-ограждениям.
    let openaiResponse: Response
    try {
        openaiResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                input: prompt,
                ...(webSearch ? { tools: [{ type: 'web_search' }] } : {}),
            }),
        })
    } catch (error) {
        console.error('[ai-assist] Сетевая ошибка запроса к OpenAI', error)
        return jsonWithCors({ error: 'openai_failed' }, 502)
    }

    if (!openaiResponse.ok) {
        console.error('[ai-assist] OpenAI ответил ошибкой', {
            status: openaiResponse.status,
            body: (await openaiResponse.text()).slice(0, 500),
        })
        return jsonWithCors({ error: 'openai_failed' }, 502)
    }

    const payload = (await openaiResponse.json()) as unknown
    const outputText = extractResponsesOutputText(payload)
    const suggestion = parseAiSuggestion(outputText)
    if (!suggestion) {
        console.error('[ai-assist] Не удалось распарсить ответ модели', {
            content: String(outputText).slice(0, 500),
        })
        return jsonWithCors({ error: 'bad_ai_response' }, 502)
    }

    console.info('[ai-assist] Успех', { kind: entity.kind, model, webSearch })
    return jsonWithCors(suggestion, 200)
})
