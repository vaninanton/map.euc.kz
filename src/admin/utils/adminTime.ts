/** Человекочитаемая давность: «только что», «N мин назад», «N ч назад», «N дн назад». */
export function formatAgo(iso: string, now: Date = new Date()): string {
    const then = new Date(iso).getTime()
    if (!Number.isFinite(then)) return '—'
    const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60_000))
    if (minutes < 1) return 'только что'
    if (minutes < 60) return `${String(minutes)} мин назад`
    const hours = Math.floor(minutes / 60)
    if (hours < 48) return `${String(hours)} ч назад`
    return `${String(Math.floor(hours / 24))} дн назад`
}

/** Часов без геопозиций, после которых считаем webhook бота проблемным. */
export const BOT_STALE_HOURS = 48

/** true, если последняя геопозиция старше порога (или её нет вовсе) — сигнал проверить webhook. */
export function isBotStale(lastLocationAt: string | null, now: Date = new Date()): boolean {
    if (!lastLocationAt) return true
    const then = new Date(lastLocationAt).getTime()
    if (!Number.isFinite(then)) return true
    return (now.getTime() - then) / 3_600_000 > BOT_STALE_HOURS
}
