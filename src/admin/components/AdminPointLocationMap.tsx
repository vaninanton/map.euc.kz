import { useEffect, useRef } from 'react'
import mapboxgl, { type MapMouseEvent, Marker } from 'mapbox-gl'
import { useMapbox } from '@/hooks/useMapbox'
import { COLORS } from '@/constants'

interface AdminPointLocationMapProps {
    coordinates: [number, number]
    onChange: (next: [number, number]) => void
}

const EPS = 1e-7

function coordsEqual(a: [number, number], b: [number, number]): boolean {
    return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS
}

export function AdminPointLocationMap({ coordinates, onChange }: AdminPointLocationMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const { map, isMapReady } = useMapbox(containerRef)
    const markerRef = useRef<Marker | null>(null)
    const onChangeRef = useRef(onChange)
    const coordinatesRef = useRef(coordinates)
    const hasToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        coordinatesRef.current = coordinates
    }, [coordinates])

    /** Центрирование при первой загрузке карты (не при каждом вводе в полях). */
    useEffect(() => {
        if (!map || !isMapReady) return
        const [lng, lat] = coordinatesRef.current
        map.jumpTo({ center: [lng, lat], zoom: 14 })
    }, [map, isMapReady])

    useEffect(() => {
        if (!map || !isMapReady) return

        const marker = new Marker({ color: COLORS.point, draggable: true }).setLngLat(coordinatesRef.current).addTo(map)

        marker.on('dragend', () => {
            const ll = marker.getLngLat()
            onChangeRef.current([ll.lng, ll.lat])
        })

        markerRef.current = marker

        const onMapClick = (e: MapMouseEvent) => {
            const { lng, lat } = e.lngLat
            onChangeRef.current([lng, lat])
            marker.setLngLat([lng, lat])
        }

        map.on('click', onMapClick)

        const nav = new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false })
        map.addControl(nav, 'bottom-right')

        return () => {
            map.off('click', onMapClick)
            map.removeControl(nav)
            marker.remove()
            markerRef.current = null
        }
    }, [map, isMapReady])

    useEffect(() => {
        if (!map || !isMapReady || !markerRef.current) return
        const m = markerRef.current
        const cur = m.getLngLat()
        const curPair: [number, number] = [cur.lng, cur.lat]
        if (coordsEqual(curPair, coordinates)) return
        m.setLngLat(coordinates)
    }, [map, isMapReady, coordinates])

    if (!hasToken) {
        return (
            <div className="flex min-h-[280px] w-full flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 text-sm text-neutral-600 lg:min-h-0">
                Задайте VITE_MAPBOX_TOKEN для редактора на карте.
            </div>
        )
    }

    return (
        <div className="flex min-h-[280px] w-full min-w-0 flex-1 flex-col gap-2 lg:min-h-0">
            <p className="shrink-0 text-xs text-neutral-500">
                Перетащите маркер или кликните по карте, чтобы задать координаты.
            </p>
            <div ref={containerRef} className="admin-editor-map rounded-xl border border-neutral-200" />
        </div>
    )
}
