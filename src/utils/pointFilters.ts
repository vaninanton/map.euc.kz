import type { PointFeature } from '@/types/geojson'

export interface PointFilterOptions {
    searchQuery: string
    typeFilter: 'all' | 'point' | 'socket'
    onlyMeeting: boolean
    onlySocket: boolean
    onlyErlan: boolean
}

export function filterPoints(
    points: PointFeature[],
    options: PointFilterOptions,
): PointFeature[] {
    const query = options.searchQuery.trim().toLowerCase()

    return points.filter((feature) => {
        // We only care about points and sockets
        if (feature.properties.type !== 'point' && feature.properties.type !== 'socket') {
            return false
        }

        const props = feature.properties

        // 1. Search Query
        if (query) {
            const name = (props.name || '').toLowerCase()
            const description = (props.description || '').toLowerCase()
            if (!name.includes(query) && !description.includes(query)) {
                return false
            }
        }

        // 2. Type Filter
        if (options.typeFilter !== 'all' && props.type !== options.typeFilter) {
            return false
        }

        // 3. Meeting Spot Filter
        if (options.onlyMeeting) {
            if (props.type !== 'point' || !props.isMeeting) {
                return false
            }
        }

        // 4. Socket Filter
        if (options.onlySocket) {
            // Sockets intrinsically have sockets, points might have hasSocket
            if (props.type === 'point' && !props.hasSocket) {
                return false
            }
            // If type is socket, it passes
        }

        // 5. Erlandia Filter
        if (options.onlyErlan && !props.isErlan) {
            return false
        }

        return true
    })
}
