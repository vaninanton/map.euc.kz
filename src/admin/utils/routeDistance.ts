import { haversineKm } from '@/utils/geoMath'

interface RouteWithCoordinates {
    coordinates: Array<[number, number] | [number, number, number]>
}

/** Длина одного маршрута в километрах по вершинам (haversine, высоты игнорируются). */
export function routeDistanceKm(route: RouteWithCoordinates): number {
    const coords = route.coordinates
    let total = 0
    for (let i = 1; i < coords.length; i++) {
        const [prevLng, prevLat] = coords[i - 1]
        const [lng, lat] = coords[i]
        total += haversineKm(prevLat, prevLng, lat, lng)
    }
    return total
}

/** Суммарная длина всех маршрутов в километрах. */
export function totalRoutesDistanceKm(routes: RouteWithCoordinates[]): number {
    return routes.reduce((sum, route) => sum + routeDistanceKm(route), 0)
}
