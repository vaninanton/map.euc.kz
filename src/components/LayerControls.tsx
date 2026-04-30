import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSliders } from '@fortawesome/free-solid-svg-icons'
import type { LayerKey, LayerVisibility } from '@/hooks/useLayers'
import type { BaseMapStyle } from '@/hooks/useMapbox'
import { LayerPanel } from '@/components/LayerPanel'
import { MapOverlayButtons } from '@/components/MapOverlayButtons'

interface LayerControlsProps {
    visibility: LayerVisibility
    onToggle: (layer: LayerKey) => void
    baseStyle: BaseMapStyle
    onBaseStyleChange: (style: BaseMapStyle) => void
    isAddingPoint: boolean
    onToggleAddPoint: () => void
    onOpenRiderGeoModal: () => void
    onLocateUser: () => void
    isLocatingUser: boolean
    onOpenProjectInfo: () => void
}

export function LayerControls({
    visibility,
    onToggle,
    baseStyle,
    onBaseStyleChange,
    isAddingPoint,
    onToggleAddPoint,
    onOpenRiderGeoModal,
    onLocateUser,
    isLocatingUser,
    onOpenProjectInfo,
}: LayerControlsProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <>
            <MapOverlayButtons
                baseStyle={baseStyle}
                onBaseStyleChange={onBaseStyleChange}
                onLocateUser={onLocateUser}
                isLocatingUser={isLocatingUser}
                onOpenProjectInfo={onOpenProjectInfo}
            />

            {isCollapsed ? (
                <button
                    type="button"
                    onClick={() => {
                        setIsCollapsed(false)
                    }}
                    className="fixed bottom-0 left-0 z-10 h-11 w-11 sm:h-12 sm:w-12 rounded-xl border border-neutral-200/80 bg-white/95 text-neutral-700 shadow-lg shadow-neutral-900/10 backdrop-blur-xl transition hover:bg-neutral-100 control-inset-left control-inset-bottom inline-flex items-center justify-center cursor-pointer"
                    aria-label="Развернуть панель слоев"
                    title="Развернуть панель слоев"
                >
                    <FontAwesomeIcon icon={faSliders} className="h-4 w-4" aria-hidden />
                </button>
            ) : (
                <LayerPanel
                    visibility={visibility}
                    onToggle={onToggle}
                    isAddingPoint={isAddingPoint}
                    onToggleAddPoint={onToggleAddPoint}
                    onOpenRiderGeoModal={onOpenRiderGeoModal}
                    onCollapse={() => {
                        setIsCollapsed(true)
                    }}
                />
            )}

        </>
    )
}
