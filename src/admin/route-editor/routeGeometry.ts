import type { FeatureCollection } from '@/types/geojson'

/** Координаты полилинии маршрута в редакторе (опционально высота на вершине). */
export type RouteEditorCoordinates = Array<[number, number] | [number, number, number]>

export function toLineStringCoords(coords: RouteEditorCoordinates): [number, number][] {
    return coords.map((p) => [p[0], p[1]])
}

export function featureCollectionFromCoords(coords: RouteEditorCoordinates): FeatureCollection {
    const line = toLineStringCoords(coords)
    if (line.length >= 2) {
        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: line },
                },
            ],
        } as FeatureCollection
    }
    return { type: 'FeatureCollection', features: [] }
}

/** Ближайшая точка на отрезке AB к P (плоские координаты lng/lat). */
export function closestOnSegment2D(
    a: [number, number],
    b: [number, number],
    p: [number, number],
): { point: [number, number]; distSq: number } {
    const [ax, ay] = a
    const [bx, by] = b
    const [px, py] = p
    const abx = bx - ax
    const aby = by - ay
    const apx = px - ax
    const apy = py - ay
    const ab2 = abx * abx + aby * aby
    if (ab2 < 1e-20) {
        const dx = px - ax
        const dy = py - ay
        return { point: a, distSq: dx * dx + dy * dy }
    }
    let t = (apx * abx + apy * aby) / ab2
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * abx
    const cy = ay + t * aby
    const distSq = (px - cx) ** 2 + (py - cy) ** 2
    return { point: [cx, cy], distSq }
}

/** Куда вставить новую вершину на линии ближе всего к клику (индекс — позиция новой точки в массиве). */
export function findInsertIndexAndPoint(
    line: [number, number][],
    click: [number, number],
): { insertIndex: number; point: [number, number] } | null {
    if (line.length < 2) return null
    let bestI = 0
    let bestDist = Infinity
    let bestPoint: [number, number] = line[0]
    for (let i = 0; i < line.length - 1; i += 1) {
        const r = closestOnSegment2D(line[i], line[i + 1], click)
        if (r.distSq < bestDist) {
            bestDist = r.distSq
            bestI = i
            bestPoint = r.point
        }
    }
    return { insertIndex: bestI + 1, point: bestPoint }
}

export function insertVertexAtIndex(
    coords: RouteEditorCoordinates,
    insertIndex: number,
    point2d: [number, number],
): RouteEditorCoordinates {
    const next = [...coords]
    next.splice(insertIndex, 0, [point2d[0], point2d[1]])
    return next
}

export function removeVertexAtIndex(coords: RouteEditorCoordinates, index: number): RouteEditorCoordinates {
    if (coords.length <= 2 || index < 0 || index >= coords.length) return coords
    return [...coords.slice(0, index), ...coords.slice(index + 1)]
}

export function updateVertexLngLat(
    coords: RouteEditorCoordinates,
    index: number,
    lng: number,
    lat: number,
): RouteEditorCoordinates {
    if (index < 0 || index >= coords.length) return coords
    const next = [...coords]
    const prev = next[index]
    if (prev.length === 3) {
        next[index] = [lng, lat, prev[2]]
    } else {
        next[index] = [lng, lat]
    }
    return next
}
