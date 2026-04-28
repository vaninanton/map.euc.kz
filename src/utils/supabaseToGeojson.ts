import type { FeatureCollection, PointFeature, RouteFeature } from '@/types/geojson';
import type { MapPointRow, MapRouteRow } from '@/types/supabase';

function isPointCoordinates(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

function isLineCoordinates(value: unknown): value is Array<[number, number] | [number, number, number]> {
  if (!Array.isArray(value) || value.length < 2) return false;
  return value.every(
    (item) =>
      Array.isArray(item) &&
      item.length >= 2 &&
      typeof item[0] === 'number' &&
      typeof item[1] === 'number' &&
      (item[2] === undefined || typeof item[2] === 'number')
  );
}

export function mapPointsToFeatureCollection(
  rows: MapPointRow[]
): FeatureCollection<{ type: 'Point'; coordinates: [number, number] }> {
  const features: PointFeature[] = rows
    .filter((row) => isPointCoordinates(row.coordinates))
    .map((row) => ({
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
      ...(row.photos.length > 0 && {
        photos: row.photos.map((photo) => ({
          id: photo.id,
          url: photo.public_url,
          alt: photo.alt_text,
          sortOrder: photo.sort_order,
        })),
      }),
      ...(row.flag_is_meeting === true && { isMeeting: true }),
      ...(row.flag_has_socket === true && { hasSocket: true }),
    },
  }));
  return { type: 'FeatureCollection', features };
}

export function mapRoutesToFeatureCollection(rows: MapRouteRow[]): FeatureCollection {
  const features: RouteFeature[] = rows
    .filter((row) => isLineCoordinates(row.coordinates))
    .map((row) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: row.coordinates,
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
