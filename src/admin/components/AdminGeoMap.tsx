import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useMapbox } from '@/hooks/useMapbox'
import { haversineKm } from '@/utils/geoMath'
import type { RiderTrack } from '@/admin/lib/adminApi/geo'

const TRACKS_SOURCE = 'admin-geo-tracks'
const LATEST_SOURCE = 'admin-geo-latest'
const TRACKS_LAYER = 'admin-geo-tracks-layer'
const LATEST_LAYER = 'admin-geo-latest-layer'
const LABELS_LAYER = 'admin-geo-labels-layer'

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
                        properties: { riderId: track.riderId, color: track.color },
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
                properties: { riderId: track.riderId, color: track.color },
                geometry: { type: 'LineString', coordinates: current },
            })
        }
    }

    return { type: 'FeatureCollection', features }
}

function buildLatestGeojson(tracks: RiderTrack[]): GeoJSON.FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: tracks.map((t) => {
            const last = t.locations[t.locations.length - 1]
            return {
                type: 'Feature' as const,
                properties: { riderId: t.riderId, color: t.color, displayName: t.displayName },
                geometry: { type: 'Point' as const, coordinates: [last.longitude, last.latitude] },
            }
        }),
    }
}

function visibleTracks(tracks: RiderTrack[], selectedRiderId: number | null): RiderTrack[] {
    return selectedRiderId !== null ? tracks.filter((t) => t.riderId === selectedRiderId) : tracks
}

export function AdminGeoMap({ tracks, selectedRiderId, onRiderClick, fitKey }: AdminGeoMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const { map, isMapReady } = useMapbox(containerRef)
    const onRiderClickRef = useRef(onRiderClick)
    const selectedRiderIdRef = useRef(selectedRiderId)
    const tracksRef = useRef(tracks)
    const hasFittedForKeyRef = useRef<number | null>(null)
    const hasToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

    useEffect(() => {
        onRiderClickRef.current = onRiderClick
    }, [onRiderClick])
    useEffect(() => {
        selectedRiderIdRef.current = selectedRiderId
    }, [selectedRiderId])
    useEffect(() => {
        tracksRef.current = tracks
    }, [tracks])

    // Setup sources, layers, event handlers — once on map ready
    useEffect(() => {
        if (!map || !isMapReady) return

        const ensureAll = () => {
            const visible = visibleTracks(tracksRef.current, selectedRiderIdRef.current)
            if (!map.getSource(TRACKS_SOURCE)) {
                map.addSource(TRACKS_SOURCE, { type: 'geojson', data: buildTracksGeojson(visible) })
            }
            if (!map.getSource(LATEST_SOURCE)) {
                map.addSource(LATEST_SOURCE, { type: 'geojson', data: buildLatestGeojson(visible) })
            }
            if (!map.getLayer(TRACKS_LAYER)) {
                map.addLayer({
                    id: TRACKS_LAYER,
                    type: 'line',
                    source: TRACKS_SOURCE,
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': 3,
                        'line-opacity': 0.85,
                    },
                })
            }
            if (!map.getLayer(LATEST_LAYER)) {
                map.addLayer({
                    id: LATEST_LAYER,
                    type: 'circle',
                    source: LATEST_SOURCE,
                    paint: {
                        'circle-color': ['get', 'color'],
                        'circle-radius': 7,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-opacity': 1,
                    },
                })
            }
            if (!map.getLayer(LABELS_LAYER)) {
                map.addLayer({
                    id: LABELS_LAYER,
                    type: 'symbol',
                    source: LATEST_SOURCE,
                    layout: {
                        'text-field': ['get', 'displayName'],
                        'text-size': 11,
                        'text-offset': [0, 1.6],
                        'text-anchor': 'top',
                    },
                    paint: {
                        'text-color': '#1f2937',
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 1.5,
                    },
                })
            }
        }

        ensureAll()
        map.on('style.load', ensureAll)

        const handleLatestClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
            const riderId = e.features?.[0]?.properties?.riderId as number | undefined
            if (riderId == null) return
            onRiderClickRef.current(selectedRiderIdRef.current === riderId ? null : riderId)
        }
        const handleTrackClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
            const riderId = e.features?.[0]?.properties?.riderId as number | undefined
            if (riderId == null) return
            onRiderClickRef.current(selectedRiderIdRef.current === riderId ? null : riderId)
        }
        const onEnterCircle = () => {
            map.getCanvas().style.cursor = 'pointer'
        }
        const onLeaveCircle = () => {
            map.getCanvas().style.cursor = ''
        }

        map.on('click', LATEST_LAYER, handleLatestClick)
        map.on('click', TRACKS_LAYER, handleTrackClick)
        map.on('mouseenter', LATEST_LAYER, onEnterCircle)
        map.on('mouseleave', LATEST_LAYER, onLeaveCircle)

        const nav = new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false })
        map.addControl(nav, 'bottom-right')

        return () => {
            map.off('style.load', ensureAll)
            map.off('click', LATEST_LAYER, handleLatestClick)
            map.off('click', TRACKS_LAYER, handleTrackClick)
            map.off('mouseenter', LATEST_LAYER, onEnterCircle)
            map.off('mouseleave', LATEST_LAYER, onLeaveCircle)
            map.removeControl(nav)
            try {
                if (map.getLayer(LABELS_LAYER)) map.removeLayer(LABELS_LAYER)
                if (map.getLayer(LATEST_LAYER)) map.removeLayer(LATEST_LAYER)
                if (map.getLayer(TRACKS_LAYER)) map.removeLayer(TRACKS_LAYER)
                if (map.getSource(LATEST_SOURCE)) map.removeSource(LATEST_SOURCE)
                if (map.getSource(TRACKS_SOURCE)) map.removeSource(TRACKS_SOURCE)
            } catch {
                // style reset
            }
        }
    }, [map, isMapReady])

    // Обновляем GeoJSON при смене треков или выбранного райдера
    useEffect(() => {
        if (!map || !isMapReady) return
        const visible = visibleTracks(tracks, selectedRiderId)
        const tracksSrc = map.getSource(TRACKS_SOURCE)
        if (tracksSrc?.type === 'geojson') tracksSrc.setData(buildTracksGeojson(visible))
        const latestSrc = map.getSource(LATEST_SOURCE)
        if (latestSrc?.type === 'geojson') latestSrc.setData(buildLatestGeojson(visible))
    }, [map, isMapReady, tracks, selectedRiderId])

    // Fit bounds: once per fitKey value (resets on period change)
    useEffect(() => {
        if (!map || !isMapReady || tracks.length === 0) return
        if (hasFittedForKeyRef.current === fitKey) return
        hasFittedForKeyRef.current = fitKey
        const all = tracks.flatMap((t) => t.locations.map((l) => [l.longitude, l.latitude] as [number, number]))
        if (all.length < 2) return
        const bounds = new mapboxgl.LngLatBounds(all[0], all[0])
        for (const p of all) bounds.extend(p)
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 })
    }, [map, isMapReady, tracks, fitKey])

    if (!hasToken) {
        return (
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 text-sm text-neutral-600">
                Задайте VITE_MAPBOX_TOKEN для карты.
            </div>
        )
    }

    return <div ref={containerRef} className="admin-editor-map rounded-xl border border-neutral-200" />
}
