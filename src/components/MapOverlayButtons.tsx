import { ProjectInfoButton } from '@/components/ProjectInfoButton'

interface MapOverlayButtonsProps {
    onOpenProjectInfo: () => void
}

export function MapOverlayButtons({ onOpenProjectInfo }: MapOverlayButtonsProps) {
    return (
        <>
            <ProjectInfoButton onClick={onOpenProjectInfo} />
        </>
    )
}
