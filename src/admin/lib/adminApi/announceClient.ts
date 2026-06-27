import { db } from '@/admin/lib/adminApi/query'

/**
 * Вызывает сабрут Edge Function telegram-location-bot и возвращает `data`.
 * `functions.invoke` сам прикладывает Authorization из сессии; сабрут проверяет
 * членство в `map_admin_users`. При ошибке логирует с контекстом и бросает.
 * Общий помощник для рассылок событий и новостей.
 */
export async function invokeAnnounce(subroute: string, body: Record<string, unknown>): Promise<unknown> {
    const { data, error } = (await db().functions.invoke(`telegram-location-bot/${subroute}`, { body })) as {
        data: unknown
        error: { message: string } | null
    }
    if (error) {
        console.error(`invokeAnnounce(${subroute}):`, error)
        throw new Error(error.message)
    }
    return data
}

/** Числовое поле из ответа Edge Function (0, если отсутствует/не число). */
export function numField(data: unknown, field: string): number {
    const v = (data as Record<string, unknown> | null)?.[field]
    return typeof v === 'number' ? v : 0
}
