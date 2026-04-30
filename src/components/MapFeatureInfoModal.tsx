import type { Feature } from '@/types/geojson'
import { FeatureSidebar } from '@/components/FeatureSidebar'

interface MapFeatureInfoModalProps {
    feature: Feature | null
    onClose: () => void
}

export function MapFeatureInfoModal({ feature, onClose }: MapFeatureInfoModalProps) {
    if (!feature) return null

    return <FeatureSidebar feature={feature} onClose={onClose} />
}
