import type { PostgrestError } from '@supabase/supabase-js'
import { requireSupabase } from '@/lib/supabase'

/** Клиент с сессией пользователя (RLS). */
export function db() {
    return requireSupabase()
}

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
