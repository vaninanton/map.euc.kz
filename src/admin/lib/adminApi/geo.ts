import type { TelegramLocationRow } from '@/types/supabase'
import { db, runManyRaw } from './query'

export interface RiderTrack {
    riderId: number
    displayName: string
    color: string
    locations: TelegramLocationRow[]
    lastSeenAt: string
}

const RIDER_COLORS = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#a855f7',
]

function getRiderName(row: TelegramLocationRow): string {
    const parts = [row.first_name, row.last_name].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
    return row.username ? `@${row.username}` : `ID ${String(row.telegram_user_id)}`
}

const LOCATIONS_SELECT =
    'id, created_at, telegram_user_id, username, first_name, last_name, longitude, latitude, location_accuracy_meters'

export async function fetchTelegramLocations(periodMinutes: number | null): Promise<TelegramLocationRow[]> {
    const since =
        periodMinutes !== null ? new Date(Date.now() - periodMinutes * 60 * 1000).toISOString() : null

    const PAGE_SIZE = 1000
    const result: TelegramLocationRow[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        const base = db()
            .from('telegram_locations')
            .select(LOCATIONS_SELECT)
            .order('telegram_user_id', { ascending: true })
            .order('created_at', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)

        const page = await runManyRaw('fetchRiderLocations', since !== null ? base.gte('created_at', since) : base)
        result.push(...(page as TelegramLocationRow[]))
        hasMore = page.length >= PAGE_SIZE
        offset += PAGE_SIZE
    }

    return result
}

export function buildRiderTracks(rows: TelegramLocationRow[]): RiderTrack[] {
    const byRider = new Map<number, TelegramLocationRow[]>()
    for (const row of rows) {
        const list = byRider.get(row.telegram_user_id) ?? []
        list.push(row)
        byRider.set(row.telegram_user_id, list)
    }
    const tracks: RiderTrack[] = []
    for (const [riderId, locations] of byRider) {
        const sorted = [...locations].sort((a, b) => a.created_at.localeCompare(b.created_at))
        const last = sorted[sorted.length - 1]
        tracks.push({
            riderId,
            displayName: getRiderName(last),
            color: RIDER_COLORS[riderId % RIDER_COLORS.length],
            locations: sorted,
            lastSeenAt: last.created_at,
        })
    }
    return tracks.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
}
