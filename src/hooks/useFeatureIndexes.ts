import { useMemo } from 'react';
import type { Feature, FeatureCollection } from '@/types/geojson';
import { getFeatureId } from '@/utils/mapFeatureGuards';

function buildIndex(collection: FeatureCollection | null): Map<string, Feature> {
  const map = new Map<string, Feature>();
  for (const feature of collection?.features ?? []) {
    const id = getFeatureId(feature);
    map.set(id, feature);
  }
  return map;
}

export function useFeatureIndexes(
  pointsGeo: FeatureCollection | null,
  routesGeo: FeatureCollection | null,
  bikeLanesGeo: FeatureCollection | null,
  telegramUsersGeo: FeatureCollection | null
) {
  const pointsById = useMemo(() => {
    const map = new Map<string, Feature>();
    for (const feature of pointsGeo?.features ?? []) {
      const id = getFeatureId(feature);
      map.set(`all:${id}`, feature);
      map.set(`${feature.properties.type}:${id}`, feature);
    }
    return map;
  }, [pointsGeo]);

  const routesById = useMemo(() => buildIndex(routesGeo), [routesGeo]);
  const bikeLanesById = useMemo(() => buildIndex(bikeLanesGeo), [bikeLanesGeo]);
  const telegramUsersById = useMemo(() => buildIndex(telegramUsersGeo), [telegramUsersGeo]);

  return { pointsById, routesById, bikeLanesById, telegramUsersById };
}
