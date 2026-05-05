import type { PostgrestError } from '@supabase/supabase-js'
import { requireSupabase } from '@/lib/supabase'

/** Клиент с сессией пользователя (RLS). */
export function db() {
    return requireSupabase()
}

/**
 * Унифицирует ответ PostgREST к простому объекту `{ data, error }`.
 * Нужен как базовый адаптер перед парсингом доменных моделей.
 */
async function unwrapPostgrest(
    promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>,
): Promise<{ data: unknown; error: PostgrestError | null }> {
    const result = await promise
    return {
        data: result.data,
        error: result.error,
    }
}

export async function runOneRaw(
    label: string,
    promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>,
): Promise<unknown> {
    const { data, error } = await unwrapPostgrest(promise)
    if (error) {
        console.error(`${label}:`, error)
        throw new Error(error.message)
    }
    if (data == null) {
        throw new Error(`${label}: пустой ответ`)
    }
    return data
}

/**
 * Выполняет запрос, который должен вернуть массив строк.
 * Бросает ошибку, если API вернул не-массив.
 */
export async function runManyRaw(
    label: string,
    promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>,
): Promise<unknown[]> {
    const { data, error } = await unwrapPostgrest(promise)
    if (error) {
        console.error(`${label}:`, error)
        throw new Error(error.message)
    }
    if (data == null) {
        return []
    }
    if (!Array.isArray(data)) {
        throw new Error(`${label}: ожидался массив записей`)
    }
    return data as unknown[]
}

/**
 * Выполняет запрос одной записи и валидирует её через `parse`.
 *
 * @throws Error Если запрос завершился ошибкой или форма данных не совпадает с ожиданием.
 */
export async function runOneParsed<T>(
    label: string,
    promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>,
    parse: (raw: unknown) => T,
): Promise<T> {
    const raw = await runOneRaw(label, promise)
    try {
        return parse(raw)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`${label}: неожиданная форма ответа (${msg})`, { cause: err })
    }
}

/**
 * Выполняет запрос списка и валидирует каждую запись через `parseItem`.
 * В текст ошибки добавляется индекс проблемной строки.
 */
export async function runManyParsed<T>(
    label: string,
    promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>,
    parseItem: (raw: unknown, index: number) => T,
): Promise<T[]> {
    const rows = await runManyRaw(label, promise)
    return rows.map((item, index) => {
        try {
            return parseItem(item, index)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new Error(`${label}[${String(index)}]: неожиданная форма записи (${msg})`, { cause: err })
        }
    })
}
