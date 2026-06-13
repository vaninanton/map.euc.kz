import type { FeatureCollection } from '@/types/geojson'
import { getTelegramGeoTtlMinutes } from '@/lib/env'

export interface ActiveRider {
    telegramUserId: number
    lon: number
    lat: number
}

/** Возвращает список активных райдеров с координатами, с TTL-фильтрацией. */
export function getActiveRiders(geo: FeatureCollection | null): ActiveRider[] {
    if (!geo) return []
    const ttlMs = getTelegramGeoTtlMinutes() * 60 * 1000
    const now = Date.now()
    const riders: ActiveRider[] = []
    for (const feature of geo.features) {
        if (feature.geometry.type !== 'Point') continue
        if (feature.properties.type !== 'telegramUser') continue
        const updatedTs = Date.parse(feature.properties.updatedAt)
        if (!Number.isFinite(updatedTs) || now - updatedTs >= ttlMs) continue
        const [lon, lat] = feature.geometry.coordinates
        riders.push({ telegramUserId: feature.properties.telegramUserId, lon, lat })
    }
    return riders
}
