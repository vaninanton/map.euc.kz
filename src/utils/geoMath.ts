/**
 * Расстояние по дуге большого круга (км), WGS84.
 */
export function haversineKm(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const earthRadiusKm = 6371
  const dLat = toRadians(toLat - fromLat)
  const dLon = toRadians(toLon - fromLon)
  const lat1 = toRadians(fromLat)
  const lat2 = toRadians(toLat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h))
}

/**
 * Начальный азимут от (fromLat, fromLon) к (toLat, toLon), градусы:
 * 0° — север, 90° — восток, по часовой стрелке.
 */
export function bearingDegrees(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const φ1 = toRadians(fromLat)
  const φ2 = toRadians(toLat)
  const Δλ = toRadians(toLon - fromLon)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  return (toDegrees(θ) + 360) % 360
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

const MAX_RADAR_KM = 10

export const RADAR_MAX_DISTANCE_KM = MAX_RADAR_KM
export const RADAR_RING_KM_LOG = [1, 3, 10] as const

/** Лог-шкала: ближние объекты растянуты, дальние сжаты */
export function radarNormalizedRadiusLog(distanceKm: number): number {
  const clamped = Math.min(Math.max(distanceKm, 0), MAX_RADAR_KM)
  return Math.log10(1 + clamped) / Math.log10(1 + MAX_RADAR_KM)
}

/**
 * Округляет вверх до ближайшего «красивого» числа (1/2/5 × 10^n).
 * Используется для динамической линейной шкалы радара.
 */
export function radarLinearScaleMax(maxRiderKm: number): number {
  if (maxRiderKm <= 0) return 0.5
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxRiderKm)))
  const normalized = maxRiderKm / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

/** @deprecated используй radarNormalizedRadiusLog */
export const radarNormalizedRadius = radarNormalizedRadiusLog
/** @deprecated используй RADAR_RING_KM_LOG */
export const RADAR_RING_KM = RADAR_RING_KM_LOG
