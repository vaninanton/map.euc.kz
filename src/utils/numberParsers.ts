const DEFAULT_RADAR_TTL_MINUTES = 30

export function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/** TTL точек на радаре: `VITE_RADAR_TTL_MINUTES` или, если не задан, `VITE_TELEGRAM_GEO_TTL_MINUTES`, иначе 30. */
export function getRadarTtlMinutes(): number {
  const radarRaw = import.meta.env.VITE_RADAR_TTL_MINUTES
  if (radarRaw) {
    return parsePositiveInt(radarRaw, DEFAULT_RADAR_TTL_MINUTES)
  }
  return parsePositiveInt(import.meta.env.VITE_TELEGRAM_GEO_TTL_MINUTES, DEFAULT_RADAR_TTL_MINUTES)
}
