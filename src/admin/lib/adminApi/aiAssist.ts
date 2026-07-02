import { db } from '@/admin/lib/adminApi/query'
import type { AiAssistEntity } from '@/admin/utils/aiAssistPrompt'

/** Предложение нейросети: улучшенные название/описание и точки интереса рядом. */
export interface AiSuggestion {
    title: string
    description: string
    pois: string[]
}

/**
 * Вызывает edge-функцию ai-assist: строит промпт на сервере, спрашивает OpenAI
 * и возвращает улучшенные название/описание (+ точки интереса при webSearch).
 * `functions.invoke` сам прикладывает Authorization из сессии; функция проверяет
 * членство в `map_admin_users`.
 */
export async function improveWithAi(entity: AiAssistEntity, webSearch: boolean): Promise<AiSuggestion> {
    const { data, error } = (await db().functions.invoke('ai-assist', { body: { entity, webSearch } })) as {
        data: unknown
        error: { message: string } | null
    }
    if (error) {
        console.error('improveWithAi:', error)
        throw new Error(error.message)
    }
    const obj = data as Record<string, unknown> | null
    if (typeof obj?.title !== 'string' || typeof obj.description !== 'string') {
        throw new Error('Некорректный ответ ai-assist')
    }
    const pois = Array.isArray(obj.pois) ? obj.pois.filter((p): p is string => typeof p === 'string') : []
    return { title: obj.title, description: obj.description, pois }
}
