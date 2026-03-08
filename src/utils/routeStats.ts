import type { LineStringFeature } from '@/types/geojson';

const EARTH_RADIUS_KM = 6371;

function haversineDistance(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function smoothElevation(elevations: number[], window = 3): number[] {
  if (elevations.length < window) return elevations;
  const result: number[] = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < elevations.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(elevations.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += elevations[j];
    result.push(sum / (end - start));
  }
  return result;
}

export interface RouteStats {
  distanceKm: number;
  ascentM: number;
  descentM: number;
  elevationMin?: number;
  elevationMax?: number;
  avgSlopePercent?: number;
  maxSlopePercent?: number;
}

export function computeRouteStats(feature: LineStringFeature): RouteStats {
  const coords = feature.geometry.coordinates;
  let distanceKm = 0;
  const elevations: number[] = [];

  for (let i = 0; i < coords.length; i++) {
    const pos = coords[i];
    if (pos.length >= 3 && typeof pos[2] === 'number') {
      elevations.push(pos[2]);
    }
    if (i > 0) {
      const prev = coords[i - 1];
      const curr = coords[i];
      distanceKm += haversineDistance([prev[0], prev[1]], [curr[0], curr[1]]);
    }
  }

  const smoothed = elevations.length >= 3 ? smoothElevation(elevations, 3) : elevations;
  let ascentM = 0;
  let descentM = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const d = smoothed[i] - smoothed[i - 1];
    if (d > 0) ascentM += d;
    else descentM += Math.abs(d);
  }

  const elevationMin = elevations.length ? Math.min(...elevations) : undefined;
  const elevationMax = elevations.length ? Math.max(...elevations) : undefined;

  let avgSlopePercent: number | undefined;
  let maxSlopePercent: number | undefined;
  if (distanceKm > 0 && smoothed.length >= 2) {
    const slopes: number[] = [];
    for (let i = 1; i < smoothed.length; i++) {
      const d = haversineDistance(
        [coords[i - 1][0], coords[i - 1][1]],
        [coords[i][0], coords[i][1]]
      );
      if (d > 0) {
        const slope = ((smoothed[i] - smoothed[i - 1]) / (d * 1000)) * 100;
        slopes.push(slope);
      }
    }
    if (slopes.length) {
      avgSlopePercent = slopes.reduce((a, b) => a + b, 0) / slopes.length;
      maxSlopePercent = Math.max(...slopes.map(Math.abs));
    }
  }

  return {
    distanceKm,
    ascentM,
    descentM,
    elevationMin,
    elevationMax,
    avgSlopePercent,
    maxSlopePercent,
  };
}
