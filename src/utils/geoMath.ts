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

/**
 * Радиус на диске радара (0…1) по лог-шкале до {@link MAX_RADAR_KM} км.
 */
export function radarNormalizedRadius(distanceKm: number): number {
  const clamped = Math.min(Math.max(distanceKm, 0), MAX_RADAR_KM)
  return Math.log10(1 + clamped) / Math.log10(1 + MAX_RADAR_KM)
}

export const RADAR_MAX_DISTANCE_KM = MAX_RADAR_KM
export const RADAR_RING_KM = [1, 3, 10] as const
