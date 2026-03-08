import type { FeatureCollection, PointFeature, LineStringFeature } from '@/types/geojson';
import type { MapPointRow, MapRouteRow } from '@/types/supabase';

export function mapPointsToFeatureCollection(rows: MapPointRow[]): FeatureCollection<{ type: 'Point'; coordinates: [number, number] }> {
  const features: PointFeature[] = rows.map((row) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: row.coordinates,
    },
    properties: {
      id: row.id,
      name: row.title,
      description: row.description ?? undefined,
      type: row.type,
      ...(row.is_meeting === true && { isMeeting: true }),
    },
  }));
  return { type: 'FeatureCollection', features };
}

export function mapRoutesToFeatureCollection(rows: MapRouteRow[]): FeatureCollection {
  const features: LineStringFeature[] = rows.map((row) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: row.coordinates as LineStringFeature['geometry']['coordinates'],
    },
    properties: {
      id: row.id,
      name: row.title,
      description: row.description ?? undefined,
      type: 'route',
    },
  }));
  return { type: 'FeatureCollection', features };
}
