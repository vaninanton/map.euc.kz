/** Вершина линии маршрута: [lng, lat] или [lng, lat, ele]. */
export type RouteVertexCoord = readonly [number, number] | readonly [number, number, number]

export interface RouteVertexElevationStats {
    vertexCount: number
    withElevationCount: number
    withoutElevationCount: number
}

/** Подсчёт вершин и наличия третьей координаты (высота). */
export function routeVertexElevationStats(coords: readonly RouteVertexCoord[]): RouteVertexElevationStats {
    const vertexCount = coords.length
    let withElevationCount = 0
    for (const p of coords) {
        if (p.length === 3) withElevationCount += 1
    }
    return {
        vertexCount,
        withElevationCount,
        withoutElevationCount: vertexCount - withElevationCount,
    }
}
