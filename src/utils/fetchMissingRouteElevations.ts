import type { RouteEditorCoordinates } from '@/admin/components/AdminRoutePolylineMap'

const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'
const BATCH_SIZE = 100

function chunk<T>(items: readonly T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size))
    }
    return out
}

/**
 * Заполняет высоту только у точек, где третья координата отсутствует.
 * Использует Open-Meteo Elevation API, чтобы не требовать отдельный ключ.
 */
export async function fillMissingRouteElevations(
    coordinates: RouteEditorCoordinates,
): Promise<RouteEditorCoordinates> {
    const missing = coordinates
        .map((coord, index) => ({ coord, index }))
        .filter(({ coord }) => coord.length < 3)

    if (missing.length === 0) return [...coordinates]

    const elevations: number[] = []
    for (const group of chunk(missing, BATCH_SIZE)) {
        const latitude = group.map(({ coord }) => String(coord[1])).join(',')
        const longitude = group.map(({ coord }) => String(coord[0])).join(',')
        const url = `${OPEN_METEO_ELEVATION_URL}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`

        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Не удалось получить высоты (${String(response.status)}).`)
        }

        const payload = (await response.json()) as { elevation?: unknown }
        if (!Array.isArray(payload.elevation) || payload.elevation.length !== group.length) {
            throw new Error('API высот вернул неожиданный ответ.')
        }

        for (const value of payload.elevation) {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new Error('API высот вернул некорректные значения.')
            }
            elevations.push(value)
        }
    }

    const next: RouteEditorCoordinates = [...coordinates]
    let eIdx = 0
    for (const { index } of missing) {
        const src = next[index]
        const ele = elevations[eIdx]
        next[index] = [src[0], src[1], ele]
        eIdx += 1
    }
    return next
}
