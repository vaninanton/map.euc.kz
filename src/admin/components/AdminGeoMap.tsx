import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { haversineKm } from '@/utils/geoMath'
import type { RiderTrack } from '@/admin/lib/adminApi/geo'
import { MAP_CENTER, MAP_ZOOM_DEFAULT } from '@/constants'

const TRACKS_SOURCE = 'admin-geo-tracks'
const TRACKS_LAYER = 'admin-geo-tracks-layer'

const TRACK_COLOR = '#00e5ff'

interface AdminGeoMapProps {
    tracks: RiderTrack[]
    selectedRiderId: number | null
    onRiderClick: (id: number | null) => void
    fitKey: number
}

const MAX_SEGMENT_KM = 1
const MAX_SEGMENT_MS = 5 * 60 * 1000

function buildTracksGeojson(tracks: RiderTrack[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = []

    for (const track of tracks) {
        if (track.locations.length < 2) continue

        const locs = track.locations
        let current: [number, number][] = [[locs[0].longitude, locs[0].latitude]]

        for (let i = 1; i < locs.length; i++) {
            const prev = locs[i - 1]
            const curr = locs[i]
            const distKm = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
            const timeMs = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()

            if (distKm >= MAX_SEGMENT_KM || timeMs >= MAX_SEGMENT_MS) {
                if (current.length >= 2) {
                    features.push({
                        type: 'Feature',
                        properties: { riderId: track.riderId },
                        geometry: { type: 'LineString', coordinates: current },
                    })
                }
                current = []
            }
            current.push([curr.longitude, curr.latitude])
        }

        if (current.length >= 2) {
            features.push({
                type: 'Feature',
                properties: { riderId: track.riderId },
                geometry: { type: 'LineString', coordinates: current },
            })
        }
    }

    return { type: 'FeatureCollection', features }
}

function visibleTracks(tracks: RiderTrack[], selectedRiderId: number | null): RiderTrack[] {
    return selectedRiderId !== null ? tracks.filter((t) => t.riderId === selectedRiderId) : tracks
}

export function AdminGeoMap({ tracks, selectedRiderId, onRiderClick, fitKey }: AdminGeoMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<mapboxgl.Map | null>(null)
    const isReadyRef = useRef(false)
    const onRiderClickRef = useRef(onRiderClick)
    const selectedRiderIdRef = useRef(selectedRiderId)
    const tracksRef = useRef(tracks)
    const hasFittedForKeyRef = useRef<number | null>(null)
    const hasToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

    useEffect(() => { onRiderClickRef.current = onRiderClick }, [onRiderClick])
    useEffect(() => { selectedRiderIdRef.current = selectedRiderId }, [selectedRiderId])
    useEffect(() => { tracksRef.current = tracks }, [tracks])

    // Инициализация карты
    useEffect(() => {
        const container = containerRef.current
        const token = import.meta.env.VITE_MAPBOX_TOKEN
        if (!container || !token) return

        mapboxgl.accessToken = token
        const map = new mapboxgl.Map({
            container,
            style: 'mapbox://styles/mapbox/standard',
            center: MAP_CENTER,
            zoom: MAP_ZOOM_DEFAULT,
            logoPosition: 'bottom-right',
            attributionControl: false,
            transformRequest: (url) => {
                if (!url) return { url }
                try {
                    if (new URL(url).hostname === 'events.mapbox.com') {
                        return { url: 'data:application/json;base64,e30=' }
                    }
                } catch { /* ignore */ }
                return { url }
            },
        })
        mapRef.current = map

        map.addControl(new mapboxgl.AttributionControl({ customAttribution: 'velojol.kz' }), 'bottom-right')
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), 'bottom-right')

        const ensureAll = () => {
            // Тёмная тема Standard-стиля
            map.setConfigProperty('basemap', 'lightPreset', 'night')

            const visible = visibleTracks(tracksRef.current, selectedRiderIdRef.current)
            if (!map.getSource(TRACKS_SOURCE)) {
                map.addSource(TRACKS_SOURCE, { type: 'geojson', data: buildTracksGeojson(visible) })
            }
            if (!map.getLayer(TRACKS_LAYER)) {
                map.addLayer({
                    id: TRACKS_LAYER,
                    type: 'line',
                    slot: 'top',
                    source: TRACKS_SOURCE,
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: {
                        'line-color': TRACK_COLOR,
                        'line-width': 1.5,
                        'line-opacity': 0.9,
                        'line-emissive-strength': 1,
                    },
                })
            }
        }

        map.on('load', () => {
            isReadyRef.current = true
            ensureAll()
        })
        map.on('style.load', ensureAll)

        const handleTrackClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
            const riderId = e.features?.[0]?.properties?.riderId as number | undefined
            if (riderId == null) return
            onRiderClickRef.current(selectedRiderIdRef.current === riderId ? null : riderId)
        }
        const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
        const onLeave = () => { map.getCanvas().style.cursor = '' }

        map.on('click', TRACKS_LAYER, handleTrackClick)
        map.on('mouseenter', TRACKS_LAYER, onEnter)
        map.on('mouseleave', TRACKS_LAYER, onLeave)

        return () => {
            isReadyRef.current = false
            map.off('style.load', ensureAll)
            map.off('click', TRACKS_LAYER, handleTrackClick)
            map.off('mouseenter', TRACKS_LAYER, onEnter)
            map.off('mouseleave', TRACKS_LAYER, onLeave)
            map.remove()
            mapRef.current = null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- инициализируется один раз
    }, [])

    // ResizeObserver
    useEffect(() => {
        const container = containerRef.current
        const map = mapRef.current
        if (!container || !map) return
        const ro = new ResizeObserver(() => { map.resize() })
        ro.observe(container)
        return () => { ro.disconnect() }
    }, [])

    // Обновляем GeoJSON при смене треков или выбранного райдера
    useEffect(() => {
        const map = mapRef.current
        if (!map || !isReadyRef.current) return
        const visible = visibleTracks(tracks, selectedRiderId)
        const src = map.getSource(TRACKS_SOURCE)
        if (src?.type === 'geojson') src.setData(buildTracksGeojson(visible))
    }, [tracks, selectedRiderId])

    // Fit bounds: один раз на каждый fitKey
    useEffect(() => {
        const map = mapRef.current
        if (!map || !isReadyRef.current || tracks.length === 0) return
        if (hasFittedForKeyRef.current === fitKey) return
        hasFittedForKeyRef.current = fitKey
        const all = tracks.flatMap((t) => t.locations.map((l) => [l.longitude, l.latitude] as [number, number]))
        if (all.length < 2) return
        const bounds = new mapboxgl.LngLatBounds(all[0], all[0])
        for (const p of all) bounds.extend(p)
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 })
    }, [tracks, fitKey])

    if (!hasToken) {
        return (
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 text-sm text-neutral-600">
                Задайте VITE_MAPBOX_TOKEN для карты.
            </div>
        )
    }

    return <div ref={containerRef} className="admin-editor-map rounded-xl border border-neutral-800" />
}
