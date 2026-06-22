import type { RouteFeature } from '@/types/geojson'
import type { RouteStats } from '@/utils/routeStats'

export interface RouteFilterOptions {
    searchQuery: string
    distanceRange: 'all' | 'under10' | '10to25' | '25to50' | 'over50'
    ascentRange: 'all' | 'flat' | 'hilly' | 'mountain'
    onlyErlan: boolean
}

export interface RouteWithStats {
    feature: RouteFeature
    stats: RouteStats
}

export function filterRoutes(routes: RouteWithStats[], options: RouteFilterOptions): RouteWithStats[] {
    const query = options.searchQuery.trim().toLowerCase()

    return routes.filter(({ feature, stats }) => {
        // 1. Search Query
        if (query) {
            const name = (feature.properties.name || '').toLowerCase()
            const description = (feature.properties.description || '').toLowerCase()
            if (!name.includes(query) && !description.includes(query)) {
                return false
            }
        }

        // 2. Distance Filter
        const dist =
            feature.properties.distance != null && Number.isFinite(feature.properties.distance)
                ? feature.properties.distance
                : stats.distanceKm
        if (options.distanceRange === 'under10' && dist >= 10) return false
        if (options.distanceRange === '10to25' && (dist < 10 || dist > 25)) return false
        if (options.distanceRange === '25to50' && (dist <= 25 || dist > 50)) return false
        if (options.distanceRange === 'over50' && dist <= 50) return false

        // 3. Ascent Filter
        const asc = stats.ascentM
        if (options.ascentRange === 'flat' && asc >= 100) return false
        if (options.ascentRange === 'hilly' && (asc < 100 || asc > 500)) return false
        if (options.ascentRange === 'mountain' && asc <= 500) return false

        // 4. Erlandia Filter
        if (options.onlyErlan && !feature.properties.isErlan) return false

        return true
    })
}
