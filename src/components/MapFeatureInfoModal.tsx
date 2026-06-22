import type { Feature } from '@/types/geojson'
import type { EventRow } from '@/types'
import { FeatureSidebar } from '@/components/FeatureSidebar'

interface MapFeatureInfoModalProps {
    feature: Feature | null
    onClose: () => void
    relatedEvents?: EventRow[]
    onOpenEvents?: () => void
}

export function MapFeatureInfoModal({ feature, onClose, relatedEvents, onOpenEvents }: MapFeatureInfoModalProps) {
    if (!feature) return null

    return (
        <FeatureSidebar
            feature={feature}
            onClose={onClose}
            relatedEvents={relatedEvents}
            onOpenEvents={onOpenEvents}
        />
    )
}
