import { MapModeToggle } from '@/components/MapModeToggle'
import { LocateUserButton } from '@/components/LocateUserButton'
import { ProjectInfoButton } from '@/components/ProjectInfoButton'
import type { BaseMapStyle } from '@/hooks/useMapbox'

interface MapOverlayButtonsProps {
    baseStyle: BaseMapStyle
    onBaseStyleChange: (style: BaseMapStyle) => void
    onLocateUser: () => void
    isLocatingUser: boolean
    onOpenProjectInfo: () => void
}

export function MapOverlayButtons({
    baseStyle,
    onBaseStyleChange,
    onLocateUser,
    isLocatingUser,
    onOpenProjectInfo,
}: MapOverlayButtonsProps) {
    return (
        <>
            <MapModeToggle baseStyle={baseStyle} onBaseStyleChange={onBaseStyleChange} />
            <LocateUserButton onLocateUser={onLocateUser} isLocatingUser={isLocatingUser} />
            <ProjectInfoButton onClick={onOpenProjectInfo} />
        </>
    )
}
