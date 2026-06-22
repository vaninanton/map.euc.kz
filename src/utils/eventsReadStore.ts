import type { EventRow } from '@/types'
import { getNextOccurrence } from '@/utils/eventSchedule'

const STORAGE_KEY = 'map-euc-events-last-read'

/** Возвращает ISO-дату последнего просмотра ленты событий или null. */
export function loadLastReadAt(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

/** Сохраняет дату последнего просмотра ленты событий. */
export function saveLastReadAt(iso: string = new Date().toISOString()): void {
    try {
        localStorage.setItem(STORAGE_KEY, iso)
    } catch {
        // ignore storage errors (private mode / quota)
    }
}

/**
 * Считает непрочитанные события: созданные позже последнего просмотра и у которых
 * есть будущее вхождение (завершившиеся события не считаем новыми). Если ленту ещё
 * ни разу не открывали (`lastReadAt === null`), новыми считаются все актуальные события.
 */
export function countUnreadEvents(events: EventRow[], lastReadAt: string | null, from: Date = new Date()): number {
    // Повреждённую/нечисловую дата последнего просмотра трактуем как «не открывали» —
    // иначе сравнение с NaN всегда ложно и бейдж непрочитанных навсегда обнуляется.
    const parsedLastRead = lastReadAt ? new Date(lastReadAt).getTime() : null
    const lastReadTime = parsedLastRead !== null && Number.isFinite(parsedLastRead) ? parsedLastRead : null
    let count = 0
    for (const event of events) {
        if (!getNextOccurrence(event, from)) continue
        if (lastReadTime === null) {
            count += 1
            continue
        }
        const createdTime = new Date(event.created_at).getTime()
        if (Number.isFinite(createdTime) && createdTime > lastReadTime) count += 1
    }
    return count
}
