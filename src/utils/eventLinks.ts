/** Сегмент пути для страницы события. */
export const EVENTS_PATH_PREFIX = 'events' as const

/**
 * Относительный путь страницы события для react-router: `/events/:id`.
 * id кодируется через encodeURIComponent.
 */
export function buildEventDetailPath(id: string): string {
    return `/${EVENTS_PATH_PREFIX}/${encodeURIComponent(id)}`
}

/**
 * Разбор pathname из react-router (уже без basename): `/events/:id` → id.
 * Возвращает null для `/events` (без id) и прочих путей.
 */
export function parseEventDetailPathname(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, '')
    const parts = trimmed.split('/').filter(Boolean)
    if (parts.length !== 2 || parts[0] !== EVENTS_PATH_PREFIX) return null
    const id = decodeURIComponent(parts[1])
    return id || null
}
