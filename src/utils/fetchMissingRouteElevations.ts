import type { RouteEditorCoordinates } from '@/admin/route-editor/routeGeometry'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/elevation'
const BATCH_SIZE = 100

function chunk<T>(items: readonly T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size))
    }
    return out
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchElevationBatch(lats: string[], lngs: string[]): Promise<number[] | null> {
    const url = `${OPEN_METEO_URL}?latitude=${encodeURIComponent(lats.join(','))}&longitude=${encodeURIComponent(lngs.join(','))}`
    const response = await fetch(url)
    if (!response.ok) return null

    const payload = (await response.json()) as { elevation?: unknown }
    if (!Array.isArray(payload.elevation) || payload.elevation.length !== lats.length) return null

    const result: number[] = []
    for (const value of payload.elevation) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null
        result.push(value)
    }
    return result
}

export interface FillElevationsResult {
    coordinates: RouteEditorCoordinates
    /** Сколько точек получили высоту в этом вызове */
    filled: number
    /** Сколько точек остались без высоты */
    remaining: number
}

/**
 * Заполняет высоту у точек без третьей координаты через Open-Meteo.
 * При ошибке чанка — пропускает его и продолжает. Возвращает частичный результат.
 */
export async function fillMissingRouteElevations(
    coordinates: RouteEditorCoordinates,
): Promise<FillElevationsResult> {
    const missing = coordinates
        .map((coord, index) => ({ coord, index }))
        .filter(({ coord }) => coord.length < 3)

    if (missing.length === 0) {
        return { coordinates: [...coordinates], filled: 0, remaining: 0 }
    }

    const next: RouteEditorCoordinates = [...coordinates]
    let filled = 0

    const groups = chunk(missing, BATCH_SIZE)
    for (let i = 0; i < groups.length; i++) {
        const group = groups.at(i) ?? []
        const lats = group.map(({ coord }) => String(coord[1]))
        const lngs = group.map(({ coord }) => String(coord[0]))

        const batch = await fetchElevationBatch(lats, lngs)
        if (batch !== null) {
            for (let j = 0; j < group.length; j++) {
                const item = group.at(j)
                const ele = batch.at(j)
                if (item !== undefined && ele !== undefined) {
                    next[item.index] = [item.coord[0], item.coord[1], ele]
                    filled++
                }
            }
        }

        if (i < groups.length - 1) await sleep(300)
    }

    const remaining = next.filter((c) => c.length < 3).length
    return { coordinates: next, filled, remaining }
}
