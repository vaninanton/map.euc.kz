import { useEffect, useState, useCallback, useRef } from 'react'
import type { Feature, FeatureCollection, BikeLaneFeature } from '@/types/geojson'
import type { TelegramLocationRow } from '@/types/supabase'
import type { VelojolSegment } from '@/types/velojol'
import {
    fetchMapPoints,
    fetchMapRoutes,
    fetchTelegramLocations,
    fetchLatestTelegramLocations,
    supabase,
} from '@/lib/supabase'
import {
    mapPointsToFeatureCollection,
    mapRoutesToFeatureCollection,
    telegramLocationsToRecentTracksFeatureCollection,
    telegramLocationsToUsersFeatureCollection,
} from '@/utils/supabaseToGeojson'
import type { LayerKey } from '@/constants'
import { useFeatureIndexes } from '@/hooks/useFeatureIndexes'
import { useTelegramRealtime } from '@/hooks/useTelegramRealtime'

/** ID велодорожек, которые не показываем на карте. */
const EXCLUDED_BIKE_LANE_IDS = new Set(['alm84', 'alm85', 'alm86', 'alm89'])

function velojolToFeatureCollection(segments: VelojolSegment[]): FeatureCollection {
    const features: BikeLaneFeature[] = segments.map((seg) => ({
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: seg.coordinates,
        },
        properties: {
            id: seg.id,
            name: seg.name,
            description: seg.description ?? null,
            distance: seg.distance,
            safetyLevel: seg.safetyLevel,
            type: 'bikeLane' as const,
        },
    }))
    return { type: 'FeatureCollection', features }
}

function buildUsersAndTracksGeo(latestRows: TelegramLocationRow[], allRows: TelegramLocationRow[]): FeatureCollection {
    const usersGeo = telegramLocationsToUsersFeatureCollection(latestRows)
    const tracksGeo = telegramLocationsToRecentTracksFeatureCollection(allRows)
    return {
        type: 'FeatureCollection',
        features: [...tracksGeo.features, ...usersGeo.features],
    }
}

/**
 * Загрузка и индексация GeoJSON слоёв карты (без видимости и без привязки к Mapbox).
 *
 * Двухфазная загрузка Telegram:
 * 1. fetchLatestTelegramLocations() — одна точка на пользователя + профиль (быстро).
 *    Результат → telegramLatestGeo (маркеры) и сразу же telegramUsersGeo (карта).
 * 2. fetchTelegramLocations() — все точки за TTL (для треков).
 *    Результат → telegramUsersGeo обновляется с треками.
 */
export function useMapData() {
    const [pointsGeo, setPointsGeo] = useState<FeatureCollection | null>(null)
    const [routesGeo, setRoutesGeo] = useState<FeatureCollection | null>(null)
    const [bikeLanesGeo, setBikeLanesGeo] = useState<FeatureCollection | null>(null)
    /** Только последние точки пользователей (без треков) — используется радаром. */
    const [telegramLatestGeo, setTelegramLatestGeo] = useState<FeatureCollection | null>(null)
    /** Маркеры + треки — используется картой. */
    const [telegramUsersGeo, setTelegramUsersGeo] = useState<FeatureCollection | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [emptyMessage, setEmptyMessage] = useState<string | null>(null)
    const telegramRefreshSeqRef = useRef(0)
    const refreshTimerIdRef = useRef<number | null>(null)

    /**
     * Перезагружает Telegram-слой и защищается от гонки запросов через seq-id.
     * Realtime-обновление: сначала latest (быстро), потом all (треки).
     */
    const refreshTelegramUsers = useCallback(async () => {
        const requestSeq = ++telegramRefreshSeqRef.current
        try {
            // Фаза 1: обновляем только маркеры радара — карту не трогаем, чтобы треки не мигали
            const latestRows = await fetchLatestTelegramLocations()
            if (requestSeq !== telegramRefreshSeqRef.current) return
            setTelegramLatestGeo(telegramLocationsToUsersFeatureCollection(latestRows))

            // Фаза 2: обновляем карту сразу с маркерами + треками
            const allRows = await fetchTelegramLocations()
            if (requestSeq !== telegramRefreshSeqRef.current) return
            setTelegramUsersGeo(buildUsersAndTracksGeo(latestRows, allRows))
        } catch (error) {
            console.error('Realtime refresh telegram users failed:', error)
        }
    }, [])

    useEffect(() => {
        const abort = { aborted: false }
        void Promise.resolve().then(() => {
            if (abort.aborted) return
            setLoading(true)
            setErrorMessage(null)
            setEmptyMessage(null)
            void (async () => {
                const [pointsResult, routesResult, latestTelegramResult, bikeLanesModule] = await Promise.allSettled([
                    fetchMapPoints(),
                    fetchMapRoutes(),
                    fetchLatestTelegramLocations(),
                    import('@/data/almaty.json'),
                ])
                if (abort.aborted) return

                if (pointsResult.status === 'fulfilled') {
                    setPointsGeo(mapPointsToFeatureCollection(pointsResult.value))
                } else {
                    setPointsGeo(null)
                }

                if (routesResult.status === 'fulfilled') {
                    setRoutesGeo(mapRoutesToFeatureCollection(routesResult.value))
                } else {
                    setRoutesGeo(null)
                }

                // Фаза 1: только последние точки — маркеры и радар готовы
                if (latestTelegramResult.status === 'fulfilled') {
                    const latestRows = latestTelegramResult.value
                    const latestGeo = telegramLocationsToUsersFeatureCollection(latestRows)
                    setTelegramLatestGeo(latestGeo)
                    setTelegramUsersGeo(latestGeo)
                } else {
                    setTelegramLatestGeo(null)
                    setTelegramUsersGeo(null)
                }

                if (bikeLanesModule.status === 'fulfilled') {
                    const raw = bikeLanesModule.value.default
                    if (Array.isArray(raw) && raw.length > 0) {
                        const segments = (raw as VelojolSegment[]).filter((seg) => !EXCLUDED_BIKE_LANE_IDS.has(seg.id))
                        setBikeLanesGeo(velojolToFeatureCollection(segments))
                    } else {
                        setBikeLanesGeo(null)
                    }
                } else {
                    setBikeLanesGeo(null)
                }

                const errors: string[] = []
                if (pointsResult.status === 'rejected') {
                    const msg =
                        pointsResult.reason instanceof Error
                            ? pointsResult.reason.message
                            : 'Не удалось загрузить точки.'
                    errors.push(msg)
                }
                if (routesResult.status === 'rejected') {
                    const msg =
                        routesResult.reason instanceof Error
                            ? routesResult.reason.message
                            : 'Не удалось загрузить маршруты.'
                    errors.push(msg)
                }
                if (latestTelegramResult.status === 'rejected') {
                    const msg =
                        latestTelegramResult.reason instanceof Error
                            ? latestTelegramResult.reason.message
                            : 'Не удалось загрузить Telegram-участников.'
                    errors.push(msg)
                }
                if (errors.length > 0) setErrorMessage(errors.join(' '))

                const pointsCount = pointsResult.status === 'fulfilled' ? pointsResult.value.length : 0
                const routesCount = routesResult.status === 'fulfilled' ? routesResult.value.length : 0
                const telegramCount =
                    latestTelegramResult.status === 'fulfilled' ? latestTelegramResult.value.length : 0
                if (pointsCount + routesCount + telegramCount === 0) {
                    setEmptyMessage('Пока нет опубликованных точек, маршрутов и Telegram-локаций.')
                }
                setLoading(false)

                // Фаза 2: все точки за TTL → треки (не блокирует UI)
                const latestRows = latestTelegramResult.status === 'fulfilled' ? latestTelegramResult.value : null
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- abort.aborted может стать true асинхронно
                if (latestRows !== null && !abort.aborted) {
                    fetchTelegramLocations()
                        .then((allRows) => {
                            if (abort.aborted) return
                            setTelegramUsersGeo(buildUsersAndTracksGeo(latestRows, allRows))
                        })
                        .catch((err: unknown) => {
                            console.error('fetchTelegramLocations (tracks phase):', err)
                        })
                }
            })()
        })
        return () => {
            abort.aborted = true
        }
    }, [])

    /**
     * Debounce для realtime-обновлений, чтобы не делать каскадные запросы.
     */
    const scheduleRealtimeRefresh = useCallback(() => {
        if (refreshTimerIdRef.current !== null) {
            window.clearTimeout(refreshTimerIdRef.current)
        }
        refreshTimerIdRef.current = window.setTimeout(() => {
            void refreshTelegramUsers()
        }, 300)
    }, [refreshTelegramUsers])

    useTelegramRealtime(supabase, scheduleRealtimeRefresh)

    useEffect(() => {
        return () => {
            if (refreshTimerIdRef.current !== null) {
                window.clearTimeout(refreshTimerIdRef.current)
            }
        }
    }, [])

    const { pointsById, routesById, bikeLanesById, telegramUsersById } = useFeatureIndexes(
        pointsGeo,
        routesGeo,
        bikeLanesGeo,
        telegramUsersGeo,
    )

    /**
     * Возвращает фичу из индекса по типу слоя и id.
     */
    const getFeatureById = useCallback(
        (layer: LayerKey, id: string): Feature | null => {
            if (layer === 'points') return pointsById.get(`point:${id}`) ?? null
            if (layer === 'sockets') return pointsById.get(`socket:${id}`) ?? null
            if (layer === 'routes') return routesById.get(id) ?? null
            if (layer === 'bikeLanes') return bikeLanesById.get(id) ?? null
            return telegramUsersById.get(id) ?? null
        },
        [pointsById, routesById, bikeLanesById, telegramUsersById],
    )

    return {
        pointsGeo,
        routesGeo,
        bikeLanesGeo,
        telegramLatestGeo,
        telegramUsersGeo,
        loading,
        errorMessage,
        emptyMessage,
        getFeatureById,
    }
}
