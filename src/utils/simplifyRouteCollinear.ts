/** Вершина маршрута в редакторе: [lng, lat] или [lng, lat, ele]. */
export type RouteEditorCoord = [number, number] | [number, number, number]

function copyPt(p: RouteEditorCoord): RouteEditorCoord {
    return p.length === 3 ? [p[0], p[1], p[2]] : [p[0], p[1]]
}

function lngLat(p: RouteEditorCoord): [number, number] {
    return [p[0], p[1]]
}

/**
 * Промежуточная точка B лишняя, если лежит на отрезке AC (плоскость lng/lat, допуск для float).
 */
function isRedundantMiddle(a: [number, number], b: [number, number], c: [number, number]): boolean {
    const [ax, ay] = a
    const [bx, by] = b
    const [cx, cy] = c
    const acx = cx - ax
    const acy = cy - ay
    const acLen = Math.hypot(acx, acy)
    if (acLen < 1e-15) {
        return Math.hypot(bx - ax, by - ay) < 1e-12 && Math.hypot(cx - bx, cy - by) < 1e-12
    }
    const abx = bx - ax
    const aby = by - ay
    const cross = abx * acy - aby * acx
    const distToLine = Math.abs(cross) / acLen
    if (distToLine > 1e-10) return false
    const dot = abx * acx + aby * acy
    const t = dot / (acLen * acLen)
    return t >= -1e-9 && t <= 1 + 1e-9
}

/**
 * Удаляет промежуточные вершины, лежащие на одной прямой со своими соседями на отрезке (вид полилинии не меняется).
 * Крайние точки сохраняются; высота у сохранённых вершин копируется как была.
 */
export function simplifyRouteCollinear(coords: readonly RouteEditorCoord[]): RouteEditorCoord[] {
    if (coords.length <= 2) return coords.map(copyPt)

    const out: RouteEditorCoord[] = [copyPt(coords[0])]

    for (let i = 1; i < coords.length; i += 1) {
        out.push(copyPt(coords[i]))
        while (out.length >= 3) {
            const n = out.length
            const pA = out[n - 3]
            const pB = out[n - 2]
            const pC = out[n - 1]
            const A = lngLat(pA)
            const B = lngLat(pB)
            const C = lngLat(pC)
            if (isRedundantMiddle(A, B, C)) {
                out.splice(out.length - 2, 1)
            } else {
                break
            }
        }
    }

    return out
}
