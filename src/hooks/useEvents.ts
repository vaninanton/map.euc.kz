import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchEvents, supabase } from '@/lib/supabase'
import { countUnreadEvents, loadLastReadAt, saveLastReadAt } from '@/utils/eventsReadStore'
import type { EventRow } from '@/types'

interface UseEventsResult {
    events: EventRow[]
    loading: boolean
    error: string | null
    /** Количество непрочитанных событий (для бейджа в таб-баре). */
    unreadCount: number
    /** Отметить ленту прочитанной (сбрасывает бейдж). */
    markAsRead: () => void
    reload: () => void
}

/**
 * Загрузка событий для публичной ленты. Хранит дату последнего просмотра в
 * localStorage и вычисляет количество непрочитанных для бейджа таб-бара.
 */
export function useEvents(): UseEventsResult {
    const [events, setEvents] = useState<EventRow[]>([])
    // Если Supabase не настроен — грузить нечего, сразу не в состоянии загрузки.
    const [loading, setLoading] = useState(() => supabase !== null)
    const [error, setError] = useState<string | null>(null)
    const [lastReadAt, setLastReadAt] = useState<string | null>(() => loadLastReadAt())

    const [reloadKey, setReloadKey] = useState(0)
    const reload = useCallback(() => {
        setReloadKey((k) => k + 1)
    }, [])

    useEffect(() => {
        if (!supabase) return
        const state = { cancelled: false }
        void Promise.resolve().then(async () => {
            setLoading(true)
            setError(null)
            try {
                const rows = await fetchEvents()
                if (!state.cancelled) setEvents(rows)
            } catch (err) {
                if (!state.cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить события')
            } finally {
                if (!state.cancelled) setLoading(false)
            }
        })
        return () => {
            state.cancelled = true
        }
    }, [reloadKey])

    const markAsRead = useCallback(() => {
        const now = new Date().toISOString()
        saveLastReadAt(now)
        setLastReadAt(now)
    }, [])

    const unreadCount = useMemo(() => countUnreadEvents(events, lastReadAt), [events, lastReadAt])

    return { events, loading, error, unreadCount, markAsRead, reload }
}
