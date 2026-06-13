import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { IControl, Map as MapboxMap } from 'mapbox-gl'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSliders } from '@fortawesome/free-solid-svg-icons'
import type { LayerKey, LayerVisibility } from '@/hooks/useLayers'
import type { BaseMapStyle } from '@/hooks/useMapbox'
import { LayerPanel } from '@/components/LayerPanel'

interface LayerControlsProps {
    map: MapboxMap | null
    isMapReady: boolean
    visibility: LayerVisibility
    onToggle: (layer: LayerKey) => void
    baseStyle: BaseMapStyle
    onToggleBaseStyle: () => void
}

export function LayerControls({
    map,
    isMapReady,
    visibility,
    onToggle,
    baseStyle,
    onToggleBaseStyle,
}: LayerControlsProps) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [layersPortal, setLayersPortal] = useState<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!map || !isMapReady) return

        const layersContainer = document.createElement('div')
        layersContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        const layersRootNode = document.createElement('div')
        layersContainer.appendChild(layersRootNode)

        const layersControl: IControl = {
            onAdd() { return layersContainer },
            onRemove() { layersContainer.remove() },
            getDefaultPosition() { return 'bottom-left' },
        }

        map.addControl(layersControl, 'bottom-left')

        const rafId = requestAnimationFrame(() => {
            setLayersPortal(layersRootNode)
        })

        return () => {
            cancelAnimationFrame(rafId)
            setLayersPortal(null)
            map.removeControl(layersControl)
        }
    }, [map, isMapReady])

    if (layersPortal === null) return null

    return createPortal(
        isCollapsed ? (
            <button
                type="button"
                onClick={() => { setIsCollapsed(false) }}
                aria-label="Развернуть панель слоев"
                title="Развернуть панель слоев"
                className="cursor-pointer"
            >
                <FontAwesomeIcon icon={faSliders} aria-hidden />
            </button>
        ) : (
            <LayerPanel
                visibility={visibility}
                onToggle={onToggle}
                onCollapse={() => { setIsCollapsed(true) }}
                baseStyle={baseStyle}
                onToggleBaseStyle={onToggleBaseStyle}
            />
        ),
        layersPortal,
    )
}
