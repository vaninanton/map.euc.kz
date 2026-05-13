import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AdminGeoMap } from '@/admin/components/AdminGeoMap'
import { fetchTelegramLocations, buildRiderTracks, type RiderTrack } from '@/admin/lib/adminApi/geo'

const PERIOD_OPTIONS: Array<{ label: string; minutes: number | null }> = [
    { label: '30 мин', minutes: 30 },
    { label: '1 ч', minutes: 60 },
    { label: '24 ч', minutes: 1440 },
    { label: '7 дней', minutes: 10080 },
    { label: 'Всё время', minutes: null },
]

function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 1) return 'только что'
    if (diffMin < 60) return `${String(diffMin)} мин. назад`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${String(diffH)} ч. назад`
    return `${String(Math.floor(diffH / 24))} д. назад`
}

export function GeoPage() {
    const [periodMinutes, setPeriodMinutes] = useState<number | null>(60)
    const [tracks, setTracks] = useState<RiderTrack[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedRiderId, setSelectedRiderId] = useState<number | null>(null)
    const [fitKey, setFitKey] = useState(0)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const rows = await fetchTelegramLocations(periodMinutes)
            setTracks(buildRiderTracks(rows))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки данных')
        } finally {
            setLoading(false)
        }
    }, [periodMinutes])

    const refreshData = useCallback(async () => {
        try {
            const rows = await fetchTelegramLocations(periodMinutes)
            setTracks(buildRiderTracks(rows))
        } catch {
            // тихое обновление — не показываем ошибку
        }
    }, [periodMinutes])

    // При смене периода: сбросить выбор, сдвинуть fitKey, загрузить данные
    useEffect(() => {
        setSelectedRiderId(null)
        setFitKey((k) => k + 1)
        void fetchData()
    }, [fetchData])

    // Realtime-обновления при новых записях в telegram_locations
    useEffect(() => {
        const client = supabase
        if (!client) return
        const channel = client
            .channel('admin-geo-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telegram_locations' }, () => {
                void refreshData()
            })
            .subscribe()
        return () => {
            void client.removeChannel(channel)
        }
    }, [refreshData])

    const handleRiderClick = useCallback((id: number | null) => {
        setSelectedRiderId(id)
    }, [])

    return (
        <section className="flex flex-col gap-4" style={{ height: 'calc(100dvh - 8rem)' }}>
            <header className="flex shrink-0 flex-wrap items-center gap-3">
                <div className="flex-1">
                    <h1 className="text-xl font-semibold">Гео</h1>
                    <p className="mt-0.5 text-sm text-neutral-600">Треки райдеров из Telegram в реальном времени.</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1">
                    {PERIOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.minutes}
                            type="button"
                            onClick={() => {
                                setPeriodMinutes(opt.minutes)
                            }}
                            className={[
                                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                                periodMinutes === opt.minutes
                                    ? 'bg-blue-600 text-white'
                                    : 'text-neutral-700 hover:bg-neutral-100',
                            ].join(' ')}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {loading && <span className="text-sm text-neutral-400">Загрузка…</span>}
            </header>

            {error && (
                <div className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div className="flex min-h-0 flex-1 gap-4">
                {/* Боковая панель с райдерами */}
                <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <div className="border-b border-neutral-200 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            Райдеры · {tracks.length}
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {!loading && tracks.length === 0 && (
                            <p className="px-4 py-6 text-center text-sm text-neutral-500">
                                Нет данных за выбранный период.
                            </p>
                        )}
                        {tracks.map((track) => (
                            <button
                                key={track.riderId}
                                type="button"
                                onClick={() => {
                                    setSelectedRiderId(selectedRiderId === track.riderId ? null : track.riderId)
                                }}
                                className={[
                                    'flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition last:border-0 hover:bg-neutral-50',
                                    selectedRiderId === track.riderId ? 'bg-blue-50' : '',
                                ].join(' ')}
                            >
                                <span
                                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                                    style={{ backgroundColor: track.color }}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-neutral-900">
                                        {track.displayName}
                                    </div>
                                    <div className="mt-0.5 text-xs text-neutral-500">
                                        {track.locations.length} точек · {formatRelativeTime(track.lastSeenAt)}
                                    </div>
                                </div>
                                {selectedRiderId === track.riderId && (
                                    <span className="shrink-0 text-xs font-semibold text-blue-600">✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                    {selectedRiderId !== null && (
                        <div className="border-t border-neutral-200 p-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedRiderId(null)
                                }}
                                className="w-full rounded-lg border border-neutral-300 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                                Показать всех
                            </button>
                        </div>
                    )}
                </aside>

                {/* Карта */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <AdminGeoMap
                        tracks={tracks}
                        selectedRiderId={selectedRiderId}
                        onRiderClick={handleRiderClick}
                        fitKey={fitKey}
                    />
                </div>
            </div>
        </section>
    )
}
