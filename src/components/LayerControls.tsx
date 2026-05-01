import { useEffect, useRef, useState } from 'react'
import type { IControl, Map as MapboxMap } from 'mapbox-gl'
import { createRoot, type Root } from 'react-dom/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faSliders, faXmark } from '@fortawesome/free-solid-svg-icons'
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
    onOpenProjectInfo: () => void
}

export function LayerControls({
    map,
    isMapReady,
    visibility,
    onToggle,
    isAddingPoint,
    onToggleAddPoint,
    onOpenProjectInfo,
}: LayerControlsProps) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const layersRootRef = useRef<Root | null>(null)
    const addPointRootRef = useRef<Root | null>(null)
    const infoRootRef = useRef<Root | null>(null)

    useEffect(() => {
        if (!map || !isMapReady) return

        const layersContainer = document.createElement('div')
        layersContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const layersRootNode = document.createElement('div')
        layersContainer.appendChild(layersRootNode)
        layersRootRef.current = createRoot(layersRootNode)

        const infoContainer = document.createElement('div')
        infoContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const infoRootNode = document.createElement('div')
        infoContainer.appendChild(infoRootNode)
        infoRootRef.current = createRoot(infoRootNode)

        const addPointContainer = document.createElement('div')
        addPointContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const addPointRootNode = document.createElement('div')
        addPointContainer.appendChild(addPointRootNode)
        addPointRootRef.current = createRoot(addPointRootNode)

        const layersControl: IControl = {
            onAdd() {
                return layersContainer
            },
            onRemove() {
                layersContainer.remove()
            },
            getDefaultPosition() {
                return 'top-left'
            },
        }

        const infoControl: IControl = {
            onAdd() {
                return infoContainer
            },
            onRemove() {
                infoContainer.remove()
            },
            getDefaultPosition() {
                return 'bottom-right'
            },
        }

        const addPointControl: IControl = {
            onAdd() {
                return addPointContainer
            },
            onRemove() {
                addPointContainer.remove()
            },
            getDefaultPosition() {
                return 'top-left'
            },
        }

        map.addControl(layersControl, 'bottom-left')
        map.addControl(addPointControl, 'top-left')
        map.addControl(infoControl, 'bottom-right')

        return () => {
            layersRootRef.current?.unmount()
            addPointRootRef.current?.unmount()
            infoRootRef.current?.unmount()
            layersRootRef.current = null
            addPointRootRef.current = null
            infoRootRef.current = null
            map.removeControl(layersControl)
            map.removeControl(addPointControl)
            map.removeControl(infoControl)
        }
    }, [map, isMapReady])

    useEffect(() => {
        layersRootRef.current?.render(
            isCollapsed ? (
                <button
                    type="button"
                    onClick={() => {
                        setIsCollapsed(false)
                    }}
                    aria-label="Развернуть панель слоев"
                    title="Развернуть панель слоев"
                >
                    <FontAwesomeIcon icon={faSliders} aria-hidden />
                </button>
            ) : (
                <LayerPanel
                    visibility={visibility}
                    onToggle={onToggle}
                    onCollapse={() => {
                        setIsCollapsed(true)
                    }}
                />
            )
        )
    }, [map, isMapReady, isCollapsed, visibility, onToggle, isAddingPoint, onToggleAddPoint])

    useEffect(() => {
        addPointRootRef.current?.render(
            <button
                type="button"
                onClick={onToggleAddPoint}
                aria-label={isAddingPoint ? 'Отменить добавление точки' : 'Добавить точку'}
                title={isAddingPoint ? 'Отменить добавление точки' : 'Добавить точку'}
            >
                <FontAwesomeIcon icon={isAddingPoint ? faXmark : faPlus} aria-hidden />
            </button>
        )
    }, [map, isMapReady, isAddingPoint, onToggleAddPoint])

    useEffect(() => {
        infoRootRef.current?.render(<ProjectInfoButton onClick={onOpenProjectInfo} />)
    }, [map, isMapReady, onOpenProjectInfo])

    return null
}
