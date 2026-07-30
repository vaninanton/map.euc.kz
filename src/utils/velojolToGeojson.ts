import type { BikeLaneFeature, FeatureCollection } from '@/types/geojson'
import type { VelojolSegment } from '@/types/velojol'

function isLineCoordinates(value: unknown): value is [number, number][] {
    if (!Array.isArray(value) || value.length < 2) return false
    return value.every(
        (item) => Array.isArray(item) && item.length >= 2 && typeof item[0] === 'number' && typeof item[1] === 'number',
    )
}

/**
 * Превращает датасет velojol.kz (`src/data/almaty.json`) в GeoJSON слоя
 * велодорожек. Сегменты с битой геометрией отбрасываются, id приводится к
 * строке — под `promoteId: 'id'` в Mapbox и deep-link `/m/bikelane/:id`.
 */
export function velojolToFeatureCollection(segments: VelojolSegment[]): FeatureCollection {
    const features: BikeLaneFeature[] = segments
        .filter((segment) => isLineCoordinates(segment.coordinates))
        .map((segment) => ({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: segment.coordinates,
            },
            properties: {
                id: String(segment.id),
                name: segment.name,
                description: segment.description ?? null,
                type: 'bikeLane',
                distance: segment.distance,
                ...(segment.laneTypeLabel && { laneTypeLabel: segment.laneTypeLabel }),
                ...(segment.quality !== undefined && {
                    quality: segment.quality,
                    qualityLabel: segment.qualityLabel,
                }),
            },
        }))
    return { type: 'FeatureCollection', features }
}
