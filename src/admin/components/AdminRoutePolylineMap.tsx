import { useCallback, useEffect, useRef } from 'react'
import mapboxgl, { Marker, type MapMouseEvent } from 'mapbox-gl'
import { useMapbox } from '@/hooks/useMapbox'
import { COLORS } from '@/constants'
import {
    type RouteEditorCoordinates,
    featureCollectionFromCoords,
    findInsertIndexAndPoint,
    insertVertexAtIndex,
    removeVertexAtIndex,
    toLineStringCoords,
    updateVertexLngLat,
} from '@/admin/route-editor/routeGeometry'

export type { RouteEditorCoordinates }

interface AdminRoutePolylineMapProps {
    coordinates: RouteEditorCoordinates
    viaCoordinates?: Array<[number, number]>
    onChange: (next: RouteEditorCoordinates) => void
    /** Наведение на маркер вершины (для подсветки строки в списке). */
    onVertexHover?: (vertexIndex: number | null) => void
    /** Индекс вершины, подсвечиваемой из списка координат. */
    highlightedVertexIndex?: number | null
}

const SOURCE_ID = 'admin-route-editor-src'
const LINE_LAYER_ID = 'admin-route-editor-line'
/** Широкая невидимая линия для попадания кликом по трассе */
const HIT_LAYER_ID = 'admin-route-editor-line-hit'

/** Маркер финиша в редакторе (старт остаётся {@link COLORS.route}). */
const ROUTE_EDITOR_FINISH_MARKER_HEX = '#15803d'
/** Маркер промежуточной точки маршрута (via). */
const ROUTE_EDITOR_VIA_MARKER_HEX = '#f59e0b'

const INTERMEDIATE_VERTEX_SIZE_PX = 14

function createIntermediateVertexElement(colorHex: string): HTMLDivElement {
    const el = document.createElement('div')
    el.style.width = `${String(INTERMEDIATE_VERTEX_SIZE_PX)}px`
    el.style.height = `${String(INTERMEDIATE_VERTEX_SIZE_PX)}px`
    el.style.borderRadius = '50%'
    el.style.backgroundColor = colorHex
    el.style.border = '2px solid #fff'
    el.style.boxSizing = 'border-box'
    el.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.35)'
    el.style.cursor = 'grab'
    return el
}

export function AdminRoutePolylineMap({
    coordinates,
    viaCoordinates = [],
    onChange,
    onVertexHover,
    highlightedVertexIndex = null,
}: AdminRoutePolylineMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const { map, isMapReady } = useMapbox(containerRef)
    const markersRef = useRef<Marker[]>([])
    const onChangeRef = useRef(onChange)
    const coordinatesRef = useRef(coordinates)
    const hasToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)
    const onVertexHoverRef = useRef(onVertexHover)
    const highlightedVertexIndexRef = useRef<number | null>(highlightedVertexIndex)
    const lastZoomedVertexIndexRef = useRef<number | null>(null)

    useEffect(() => {
        onVertexHoverRef.current = onVertexHover
    }, [onVertexHover])

    useEffect(() => {
        highlightedVertexIndexRef.current = highlightedVertexIndex
    }, [highlightedVertexIndex])

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        coordinatesRef.current = coordinates
    }, [coordinates])

    const isSameLngLat = useCallback((a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1], [])

    const setMarkerHighlighted = useCallback((marker: Marker, highlighted: boolean) => {
        const el = marker.getElement()
        if (highlighted) {
            // Важно: не трогаем transform — Mapbox использует его для позиционирования маркера.
            el.style.outline = '3px solid rgba(245, 158, 11, 0.95)'
            el.style.outlineOffset = '2px'
            el.style.zIndex = '10'
            el.style.filter = 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))'
        } else {
            el.style.outline = ''
            el.style.outlineOffset = ''
            el.style.zIndex = ''
            el.style.filter = ''
        }
    }, [])

    const applyHighlightedIndex = useCallback(
        (index: number | null) => {
            const list = markersRef.current
            for (let i = 0; i < list.length; i += 1) {
                setMarkerHighlighted(list[i], index !== null && i === index)
            }
        },
        [setMarkerHighlighted],
    )

    const rebuildMarkers = useCallback(
        (mapInstance: mapboxgl.Map, coords: RouteEditorCoordinates) => {
            for (const m of markersRef.current) {
                m.remove()
            }
            markersRef.current = []
            const lastIndex = coords.length - 1
            coords.forEach((coord, index) => {
                const isIntermediate = coords.length >= 2 && index > 0 && index < lastIndex
                const point2d: [number, number] = [coord[0], coord[1]]
                const isVia = isIntermediate && viaCoordinates.some((viaPoint) => isSameLngLat(viaPoint, point2d))
                const marker = isIntermediate
                    ? new Marker({
                          element: createIntermediateVertexElement(isVia ? ROUTE_EDITOR_VIA_MARKER_HEX : COLORS.route),
                          draggable: true,
                          anchor: 'center',
                      })
                    : new Marker({
                          color:
                              coords.length >= 2 && index === lastIndex ? ROUTE_EDITOR_FINISH_MARKER_HEX : COLORS.route,
                          draggable: true,
                      })
                marker.setLngLat([coord[0], coord[1]]).addTo(mapInstance)

                const el = marker.getElement()
                const onEnter = () => {
                    onVertexHoverRef.current?.(index)
                }
                const onLeave = () => {
                    onVertexHoverRef.current?.(null)
                }
                el.addEventListener('mouseenter', onEnter)
                el.addEventListener('mouseleave', onLeave)

                el.addEventListener(
                    'dblclick',
                    (ev) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        const base = coordinatesRef.current
                        if (base.length <= 2) return
                        onChangeRef.current(removeVertexAtIndex(base, index))
                    },
                    true,
                )

                el.addEventListener(
                    'contextmenu',
                    (ev) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        const base = coordinatesRef.current
                        if (base.length <= 2) return
                        onChangeRef.current(removeVertexAtIndex(base, index))
                    },
                    true,
                )

                marker.on('dragstart', () => {
                    onVertexHoverRef.current?.(null)
                })

                marker.on('dragend', () => {
                    const ll = marker.getLngLat()
                    const base = coordinatesRef.current
                    onChangeRef.current(updateVertexLngLat(base, index, ll.lng, ll.lat))
                })

                markersRef.current.push(marker)
            })
            applyHighlightedIndex(highlightedVertexIndexRef.current)
        },
        [applyHighlightedIndex, isSameLngLat, viaCoordinates],
    )

    const applySourceData = useCallback((mapInstance: mapboxgl.Map, coords: RouteEditorCoordinates) => {
        const fc = featureCollectionFromCoords(coords)
        const src = mapInstance.getSource(SOURCE_ID)
        if (src?.type === 'geojson') {
            src.setData(fc)
        }
    }, [])

    useEffect(() => {
        if (!map || !isMapReady) return
        map.doubleClickZoom.disable()

        const ensureLayers = () => {
            if (!map.getSource(SOURCE_ID)) {
                map.addSource(SOURCE_ID, {
                    type: 'geojson',
                    data: featureCollectionFromCoords(coordinatesRef.current),
                })
                map.addLayer({
                    id: LINE_LAYER_ID,
                    type: 'line',
                    source: SOURCE_ID,
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round',
                    },
                    paint: {
                        'line-color': COLORS.route,
                        'line-width': 4,
                        'line-opacity': 0.9,
                    },
                })
                map.addLayer({
                    id: HIT_LAYER_ID,
                    type: 'line',
                    source: SOURCE_ID,
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round',
                    },
                    paint: {
                        'line-color': '#000',
                        'line-width': 18,
                        'line-opacity': 0,
                    },
                })
            } else {
                applySourceData(map, coordinatesRef.current)
            }
        }

        ensureLayers()

        const onStyleLoad = () => {
            ensureLayers()
            rebuildMarkers(map, coordinatesRef.current)
        }

        map.on('style.load', onStyleLoad)

        rebuildMarkers(map, coordinatesRef.current)
        applySourceData(map, coordinatesRef.current)

        const onMapClick = (e: MapMouseEvent) => {
            const { lng, lat } = e.lngLat
            const cur = coordinatesRef.current

            const hits = map.queryRenderedFeatures(e.point, { layers: [HIT_LAYER_ID] })
            const line2d = toLineStringCoords(cur)
            if (hits.length > 0 && line2d.length >= 2) {
                const found = findInsertIndexAndPoint(line2d, [lng, lat])
                if (found) {
                    onChangeRef.current(insertVertexAtIndex(cur, found.insertIndex, found.point))
                    return
                }
            }

            onChangeRef.current([...cur, [lng, lat]])
        }

        map.on('click', onMapClick)

        const nav = new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false })
        map.addControl(nav, 'bottom-right')

        return () => {
            map.doubleClickZoom.enable()
            map.off('style.load', onStyleLoad)
            map.off('click', onMapClick)
            map.removeControl(nav)
            for (const m of markersRef.current) {
                m.remove()
            }
            markersRef.current = []
            try {
                if (map.getLayer(HIT_LAYER_ID)) map.removeLayer(HIT_LAYER_ID)
                if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
                if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
            } catch {
                // стиль мог быть сброшен
            }
        }
    }, [map, isMapReady, applySourceData, rebuildMarkers])

    useEffect(() => {
        if (!map || !isMapReady) return
        applySourceData(map, coordinates)
        rebuildMarkers(map, coordinates)
    }, [map, isMapReady, coordinates, viaCoordinates, applySourceData, rebuildMarkers])

    useEffect(() => {
        applyHighlightedIndex(highlightedVertexIndex)
    }, [highlightedVertexIndex, applyHighlightedIndex])

    useEffect(() => {
        if (!map || !isMapReady) return
        if (highlightedVertexIndex === null) {
            lastZoomedVertexIndexRef.current = null
            return
        }
        if (highlightedVertexIndex < 0 || highlightedVertexIndex >= coordinates.length) return
        if (lastZoomedVertexIndexRef.current === highlightedVertexIndex) return

        const coord = coordinates[highlightedVertexIndex]
        const currentZoom = map.getZoom()
        const targetZoom = Math.max(currentZoom, 15)
        map.easeTo({
            center: [coord[0], coord[1]],
            zoom: targetZoom,
            duration: 250,
        })
        lastZoomedVertexIndexRef.current = highlightedVertexIndex
    }, [map, isMapReady, highlightedVertexIndex, coordinates])

    /** Вписать линию в вид при открытии редактора (один раз при готовности карты). */
    useEffect(() => {
        if (!map || !isMapReady) return
        const line = toLineStringCoords(coordinatesRef.current)
        if (line.length >= 2) {
            const bounds = new mapboxgl.LngLatBounds(line[0], line[0])
            for (const p of line) {
                bounds.extend(p)
            }
            map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 })
            return
        }
        if (line.length === 1) {
            map.jumpTo({ center: line[0], zoom: 14 })
        }
    }, [map, isMapReady])

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
                Перетаскивайте вершины: старт красный, финиш зелёный, промежуточные via-точки оранжевые. Клик по линии
                вставляет вершину на выбранный сегмент, клик по пустому месту добавляет точку в конец. Правый клик по
                маркеру вершины удаляет её (не ниже двух вершин). Для сохранения нужно минимум две вершины.
            </p>
            <div ref={containerRef} className="admin-editor-map rounded-xl border border-neutral-200" />
        </div>
    )
}
