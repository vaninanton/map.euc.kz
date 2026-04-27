import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Feature, FeatureCollection, BikeLaneFeature } from '@/types/geojson';
import type { VelojolSegment } from '@/types/velojol';
import { fetchMapPoints, fetchMapRoutes } from '@/lib/supabase';
import { mapPointsToFeatureCollection, mapRoutesToFeatureCollection } from '@/utils/supabaseToGeojson';
import { addLayersToMap as addLayersToMapImpl } from '@/lib/mapLayers';
import { LAYER_IDS, type LayerKey } from '@/constants';
import type { Map as MapboxMap } from 'mapbox-gl';
import { getFeatureId, isRecord } from '@/utils/mapFeatureGuards';

export type { LayerKey };

export interface LayerVisibility {
  points: boolean;
  sockets: boolean;
  routes: boolean;
  bikeLanes: boolean;
}

const STORAGE_KEY = 'map-euc-layer-visibility';

const DEFAULT_VISIBILITY: LayerVisibility = {
  points: true,
  sockets: true,
  routes: true,
  bikeLanes: true,
};

function loadStoredVisibility(): LayerVisibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBILITY;
    const parsed: unknown = JSON.parse(raw);
    const source = isRecord(parsed) ? parsed : {};
    return {
      points: typeof source.points === 'boolean' ? source.points : DEFAULT_VISIBILITY.points,
      sockets: typeof source.sockets === 'boolean' ? source.sockets : DEFAULT_VISIBILITY.sockets,
      routes: typeof source.routes === 'boolean' ? source.routes : DEFAULT_VISIBILITY.routes,
      bikeLanes: typeof source.bikeLanes === 'boolean' ? source.bikeLanes : DEFAULT_VISIBILITY.bikeLanes,
    };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

/** ID велодорожек, которые не показываем на карте. */
const EXCLUDED_BIKE_LANE_IDS = new Set(['alm84', 'alm85', 'alm86', 'alm89']);

function velojolToFeatureCollection(segments: VelojolSegment[]): FeatureCollection {
  const features: BikeLaneFeature[] = segments.map((seg) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: seg.coordinates,
    },
    properties: {
      id: seg.id,
      name: seg.name,
      description: seg.description ?? null,
      distance: seg.distance,
      safetyLevel: seg.safetyLevel,
      type: 'bikeLane' as const,
    },
  }));
  return { type: 'FeatureCollection', features };
}

export function useLayers() {
  const [pointsGeo, setPointsGeo] = useState<FeatureCollection | null>(null);
  const [routesGeo, setRoutesGeo] = useState<FeatureCollection | null>(null);
  const [bikeLanesGeo, setBikeLanesGeo] = useState<FeatureCollection | null>(null);
  const [visibility, setVisibility] = useState<LayerVisibility>(loadStoredVisibility);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    setEmptyMessage(null);
    void (async () => {
      const [pointsResult, routesResult, bikeLanesModule] = await Promise.allSettled([
        fetchMapPoints(),
        fetchMapRoutes(),
        import('@/data/almaty.json'),
      ]);
      if (cancelled) return;

      if (pointsResult.status === 'fulfilled') {
        setPointsGeo(mapPointsToFeatureCollection(pointsResult.value));
      } else {
        setPointsGeo(null);
      }

      if (routesResult.status === 'fulfilled') {
        setRoutesGeo(mapRoutesToFeatureCollection(routesResult.value));
      } else {
        setRoutesGeo(null);
      }

      if (bikeLanesModule.status === 'fulfilled') {
        const raw = bikeLanesModule.value.default;
        if (Array.isArray(raw) && raw.length > 0) {
          const segments = (raw as VelojolSegment[]).filter(
            (seg) => !EXCLUDED_BIKE_LANE_IDS.has(seg.id)
          );
          setBikeLanesGeo(velojolToFeatureCollection(segments));
        } else {
          setBikeLanesGeo(null);
        }
      } else {
        setBikeLanesGeo(null);
      }

      const errors: string[] = [];
      if (pointsResult.status === 'rejected') {
        const msg = pointsResult.reason instanceof Error ? pointsResult.reason.message : 'Не удалось загрузить точки.';
        errors.push(msg);
      }
      if (routesResult.status === 'rejected') {
        const msg = routesResult.reason instanceof Error ? routesResult.reason.message : 'Не удалось загрузить маршруты.';
        errors.push(msg);
      }
      if (errors.length > 0) setErrorMessage(errors.join(' '));

      const pointsCount = pointsResult.status === 'fulfilled' ? pointsResult.value.length : 0;
      const routesCount = routesResult.status === 'fulfilled' ? routesResult.value.length : 0;
      if (pointsCount + routesCount === 0) {
        setEmptyMessage('Пока нет опубликованных точек и маршрутов.');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pointsById = useMemo(() => {
    const map = new Map<string, Feature>();
    for (const feature of pointsGeo?.features ?? []) {
      const id = getFeatureId(feature);
      map.set(`all:${id}`, feature);
      map.set(`${feature.properties.type}:${id}`, feature);
    }
    return map;
  }, [pointsGeo]);

  const routesById = useMemo(() => {
    const map = new Map<string, Feature>();
    for (const feature of routesGeo?.features ?? []) {
      const id = getFeatureId(feature);
      map.set(id, feature);
    }
    return map;
  }, [routesGeo]);

  const bikeLanesById = useMemo(() => {
    const map = new Map<string, Feature>();
    for (const feature of bikeLanesGeo?.features ?? []) {
      const id = getFeatureId(feature);
      map.set(id, feature);
    }
    return map;
  }, [bikeLanesGeo]);

  const toggleLayer = useCallback((layer: LayerKey) => {
    setVisibility((v) => {
      const next = { ...v, [layer]: !v[layer] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const addLayersToMap = useCallback(
    (map: MapboxMap) => {
      addLayersToMapImpl(map, {
        pointsGeo,
        routesGeo,
        bikeLanesGeo,
        socketsVisible: visibility.sockets,
      });
    },
    [pointsGeo, routesGeo, bikeLanesGeo, visibility.sockets]
  );

  const applyVisibility = useCallback(
    (map: MapboxMap | null) => {
      if (!map) return;
      const setVis = (layerId: string, visible: boolean) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      };
      setVis(LAYER_IDS.points, visibility.points);
      setVis(LAYER_IDS.sockets, visibility.sockets);
      setVis(LAYER_IDS.routes, visibility.routes);
      setVis(LAYER_IDS.bikeLanes, visibility.bikeLanes);
    },
    [visibility]
  );

  const getFeatureById = useCallback(
    (layer: LayerKey, id: string): Feature | null => {
      const idNorm = String(id);
      if (layer === 'points') return pointsById.get(`point:${idNorm}`) ?? null;
      if (layer === 'sockets') return pointsById.get(`socket:${idNorm}`) ?? null;
      if (layer === 'routes') return routesById.get(idNorm) ?? null;
      return bikeLanesById.get(idNorm) ?? null;
    },
    [pointsById, routesById, bikeLanesById]
  );

  return {
    pointsGeo,
    routesGeo,
    bikeLanesGeo,
    visibility,
    loading,
    errorMessage,
    emptyMessage,
    toggleLayer,
    addLayersToMap,
    applyVisibility,
    getFeatureById,
  };
}
