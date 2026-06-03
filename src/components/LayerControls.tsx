import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { IControl, Map as MapboxMap } from 'mapbox-gl'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationCrosshairs, faPlus, faSliders, faXmark, faRoute, faMapPin } from '@fortawesome/free-solid-svg-icons'
import type { LayerKey, LayerVisibility } from '@/hooks/useLayers'
import { LayerPanel } from '@/components/LayerPanel'
import { ProjectInfoButton } from '@/components/ProjectInfoButton'

interface LayerControlsProps {
    map: MapboxMap | null
    isMapReady: boolean
    visibility: LayerVisibility
    onToggle: (layer: LayerKey) => void
    isAddingPoint: boolean
    onToggleAddPoint: () => void
    isRadarOpen: boolean
    onToggleRadar: () => void
    onOpenProjectInfo: () => void
    isRouteListOpen: boolean
    onToggleRouteList: () => void
    isPointListOpen: boolean
    onTogglePointList: () => void
}

interface MapControlPortals {
    layers: HTMLDivElement | null
    addPoint: HTMLDivElement | null
    info: HTMLDivElement | null
    radar: HTMLDivElement | null
    routes: HTMLDivElement | null
    pointList: HTMLDivElement | null
}

const EMPTY_PORTALS: MapControlPortals = { layers: null, addPoint: null, info: null, radar: null, routes: null, pointList: null }

export function LayerControls({
    map,
    isMapReady,
    visibility,
    onToggle,
    isAddingPoint,
    onToggleAddPoint,
    isRadarOpen,
    onToggleRadar,
    onOpenProjectInfo,
    isRouteListOpen,
    onToggleRouteList,
    isPointListOpen,
    onTogglePointList,
}: LayerControlsProps) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [portals, setPortals] = useState<MapControlPortals>(EMPTY_PORTALS)

    useEffect(() => {
        if (!map || !isMapReady) return

        const layersContainer = document.createElement('div')
        layersContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const layersRootNode = document.createElement('div')
        layersContainer.appendChild(layersRootNode)

        const infoContainer = document.createElement('div')
        infoContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const infoRootNode = document.createElement('div')
        infoContainer.appendChild(infoRootNode)

        const addPointContainer = document.createElement('div')
        addPointContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const addPointRootNode = document.createElement('div')
        addPointContainer.appendChild(addPointRootNode)

        const radarContainer = document.createElement('div')
        radarContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const radarRootNode = document.createElement('div')
        radarContainer.appendChild(radarRootNode)

        const routesContainer = document.createElement('div')
        routesContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const routesRootNode = document.createElement('div')
        routesContainer.appendChild(routesRootNode)

        const pointListContainer = document.createElement('div')
        pointListContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const pointListRootNode = document.createElement('div')
        pointListContainer.appendChild(pointListRootNode)

        const layersControl: IControl = {
            onAdd() { return layersContainer },
            onRemove() { layersContainer.remove() },
            getDefaultPosition() { return 'bottom-left' },
        }

        const infoControl: IControl = {
            onAdd() { return infoContainer },
            onRemove() { infoContainer.remove() },
            getDefaultPosition() { return 'bottom-right' },
        }

        const addPointControl: IControl = {
            onAdd() { return addPointContainer },
            onRemove() { addPointContainer.remove() },
            getDefaultPosition() { return 'top-left' },
        }

        const routesControl: IControl = {
            onAdd() { return routesContainer },
            onRemove() { routesContainer.remove() },
            getDefaultPosition() { return 'top-left' },
        }

        const pointListControl: IControl = {
            onAdd() { return pointListContainer },
            onRemove() { pointListContainer.remove() },
            getDefaultPosition() { return 'top-left' },
        }

        const radarControl: IControl = {
            onAdd() { return radarContainer },
            onRemove() { radarContainer.remove() },
            getDefaultPosition() { return 'top-right' },
        }

        map.addControl(layersControl, 'bottom-left')
        map.addControl(addPointControl, 'top-left')
        map.addControl(routesControl, 'top-left')
        map.addControl(pointListControl, 'top-left')
        map.addControl(infoControl, 'bottom-right')
        map.addControl(radarControl, 'top-right')

        const rafId = requestAnimationFrame(() => {
            setPortals({
                layers: layersRootNode,
                addPoint: addPointRootNode,
                info: infoRootNode,
                radar: radarRootNode,
                routes: routesRootNode,
                pointList: pointListRootNode,
            })
        })

        return () => {
            cancelAnimationFrame(rafId)
            setPortals(EMPTY_PORTALS)
            map.removeControl(layersControl)
            map.removeControl(addPointControl)
            map.removeControl(routesControl)
            map.removeControl(pointListControl)
            map.removeControl(infoControl)
            map.removeControl(radarControl)
        }
    }, [map, isMapReady])

    return (
        <>
            {portals.layers !== null &&
                createPortal(
                    isCollapsed ? (
                        <button
                            type="button"
                            onClick={() => { setIsCollapsed(false) }}
                            aria-label="Развернуть панель слоев"
                            title="Развернуть панель слоев"
                        >
                            <FontAwesomeIcon icon={faSliders} aria-hidden />
                        </button>
                    ) : (
                        <LayerPanel
                            visibility={visibility}
                            onToggle={onToggle}
                            onCollapse={() => { setIsCollapsed(true) }}
                        />
                    ),
                    portals.layers,
                )}
            {portals.addPoint !== null &&
                createPortal(
                    <button
                        type="button"
                        onClick={onToggleAddPoint}
                        aria-label={isAddingPoint ? 'Отменить добавление точки' : 'Добавить точку'}
                        title={isAddingPoint ? 'Отменить добавление точки' : 'Добавить точку'}
                    >
                        <FontAwesomeIcon icon={isAddingPoint ? faXmark : faPlus} aria-hidden />
                    </button>,
                    portals.addPoint,
                )}
            {portals.routes !== null &&
                createPortal(
                    <button
                        type="button"
                        onClick={onToggleRouteList}
                        className={isRouteListOpen ? 'bg-[#f25824]! text-white!' : ''}
                        aria-label={isRouteListOpen ? 'Закрыть список маршрутов' : 'Открыть список маршрутов'}
                        title="Список маршрутов"
                    >
                        <FontAwesomeIcon icon={faRoute} aria-hidden />
                    </button>,
                    portals.routes,
                )}
            {portals.pointList !== null &&
                createPortal(
                    <button
                        type="button"
                        onClick={onTogglePointList}
                        className={isPointListOpen ? 'bg-blue-500! text-white!' : ''}
                        aria-label={isPointListOpen ? 'Закрыть список точек' : 'Открыть список точек'}
                        title="Список точек"
                    >
                        <FontAwesomeIcon icon={faMapPin} aria-hidden />
                    </button>,
                    portals.pointList,
                )}
            {portals.info !== null &&
                createPortal(<ProjectInfoButton onClick={onOpenProjectInfo} />, portals.info)}
            {portals.radar !== null &&
                createPortal(
                    <button
                        type="button"
                        onClick={onToggleRadar}
                        aria-label={isRadarOpen ? 'Закрыть радар' : 'Открыть радар'}
                        title="Радар"
                    >
                        <FontAwesomeIcon icon={faLocationCrosshairs} aria-hidden />
                    </button>,
                    portals.radar,
                )}
        </>
    )
}
