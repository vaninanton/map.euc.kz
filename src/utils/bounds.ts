import type { Feature } from '@/types/geojson';

export function getFeatureBounds(feature: Feature): [[number, number], [number, number]] {
  const g = feature.geometry;
  if (g.type === 'Point') {
    const [lon, lat] = g.coordinates;
    const d = 0.001;
    return [
      [lon - d, lat - d],
      [lon + d, lat + d],
    ];
  }
  if (g.coordinates.length > 0) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const c of g.coordinates) {
      const [lon, lat] = c;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const pad = 0.001;
    return [
      [minLon - pad, minLat - pad],
      [maxLon + pad, maxLat + pad],
    ];
  }
  return [
    [0, 0],
    [0, 0],
  ];
}

export function getFeatureCenter(feature: Feature): [number, number] {
  const g = feature.geometry;
  if (g.type === 'Point') {
    return [...g.coordinates];
  }
  if (g.coordinates.length > 0) {
    const n = g.coordinates.length;
    const mid = Math.floor(n / 2);
    const c = g.coordinates[mid];
    return [c[0], c[1]];
  }
  return [0, 0];
}
