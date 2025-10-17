import type { Feature, LineString, Point, Position } from 'geojson'
import * as L from 'leaflet'

export default function calculateRouteDistance(feature: Feature<LineString | Point, Record<string, any>>): {
    distance: number
    gain: number
    loss: number
    avgGrade: number // %
    maxGrade: number // %
    maxElevation: number // м
    minElevation: number // м
    twistiness: number // 1 = прямая линия, >1 = извилисто
    difficulty: number // 1–5, субъективно
} {
    const MAX_DIFFICULTY = 100 // или 100, или сколько хочешь

    let distance = 0,
        gain = 0,
        loss = 0
    let maxGrade = 0
    let grades: number[] = []
    let maxElevation = -Infinity
    let minElevation = Infinity
    let avgGrade = 0
    let totalDistance = 0
    let directDistance = 0
    let twistiness = 0
    let difficulty = 0

    if (feature.geometry.type !== 'LineString') {
        return {
            distance,
            gain,
            loss,
            avgGrade,
            maxGrade,
            maxElevation,
            minElevation,
            twistiness,
            difficulty,
        }
    }

    const coords = feature.geometry.coordinates
    if (coords.length < 2) throw new Error('Недостаточно точек маршрута')

    for (let i = 1; i < coords.length - 1; i++) {
        coords[i][2] = (coords[i-1][2] + coords[i][2] + coords[i+1][2]) / 3
    }

    for (let index = 1; index < coords.length; index++) {
        const [lon1, lat1, h1] = coords[index - 1] as Position
        const [lon2, lat2, h2] = coords[index] as Position

        const dHoriz = L.latLng(lat1, lon1).distanceTo(L.latLng(lat2, lon2))
        distance += dHoriz

        if (h1 != null && h2 != null) {
            const dh = h2 - h1
            if (dh > 0) gain += dh
            else loss -= dh

            if (dHoriz > 10) {
                const grade = (dh / dHoriz) * 100
                if (Math.abs(grade) < 30) { // максимальный уклон, остальное шум
                    grades.push(grade)
                    if (Math.abs(grade) > Math.abs(maxGrade)) maxGrade = grade
                }
            }

            if (h1 > maxElevation) maxElevation = h1
            if (h2 > maxElevation) maxElevation = h2
            if (h1 < minElevation) minElevation = h1
            if (h2 < minElevation) minElevation = h2
        }
    }
    avgGrade = grades.reduce((sum, g) => sum + Math.abs(g), 0) / grades.length || 0

    totalDistance = distance / 1000 // км
    directDistance =
        L.latLng(coords[0][1], coords[0][0]).distanceTo(L.latLng(coords.at(-1)![1], coords.at(-1)![0])) / 1000

    twistiness = totalDistance / (directDistance || 1)

    // Пример грубой шкалы сложности
    const raw = (gain / 100 + avgGrade / 2) / 3
    difficulty = Math.min(MAX_DIFFICULTY, Math.round((raw / 5) * MAX_DIFFICULTY))
    return {
        distance: distance / 1000,
        gain,
        loss,
        avgGrade: +avgGrade.toFixed(2),
        maxGrade: +maxGrade.toFixed(2),
        maxElevation: Math.round(maxElevation),
        minElevation: Math.round(minElevation),
        twistiness: +twistiness.toFixed(2),
        difficulty,
    }
}
