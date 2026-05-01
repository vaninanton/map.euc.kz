import { MapModeToggle } from '@/components/MapModeToggle'
import { ProjectInfoButton } from '@/components/ProjectInfoButton'
import type { BaseMapStyle } from '@/hooks/useMapbox'

interface MapOverlayButtonsProps {
    baseStyle: BaseMapStyle
    onBaseStyleChange: (style: BaseMapStyle) => void
    onOpenProjectInfo: () => void
}

export function MapOverlayButtons({
    baseStyle,
    onBaseStyleChange,
    onOpenProjectInfo,
}: MapOverlayButtonsProps) {
    return (
        <>
            <MapModeToggle baseStyle={baseStyle} onBaseStyleChange={onBaseStyleChange} />
            <ProjectInfoButton onClick={onOpenProjectInfo} />
        </>
    )
}
