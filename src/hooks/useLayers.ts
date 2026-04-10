import { useEffect, useState, useCallback } from 'react';
import type { Feature, FeatureCollection } from '@/types/geojson';
import type { VelojolSegment } from '@/types/velojol';
import { fetchMapPoints, fetchMapRoutes } from '@/lib/supabase';
import { mapPointsToFeatureCollection, mapRoutesToFeatureCollection } from '@/utils/supabaseToGeojson';
import { addLayersToMap as addLayersToMapImpl } from '@/lib/mapLayers';
import { LAYER_IDS, type LayerKey } from '@/constants';
import almatySegments from '@/data/almaty.json';
import type { Map as MapboxMap } from 'mapbox-gl';

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
    const parsed = JSON.parse(raw) as Partial<LayerVisibility>;
    return {
      points: parsed.points ?? DEFAULT_VISIBILITY.points,
      sockets: parsed.sockets ?? DEFAULT_VISIBILITY.sockets,
      routes: parsed.routes ?? DEFAULT_VISIBILITY.routes,
      bikeLanes: parsed.bikeLanes ?? DEFAULT_VISIBILITY.bikeLanes,
    };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

/** ID велодорожек, которые не показываем на карте. */
const EXCLUDED_BIKE_LANE_IDS = new Set(['alm84', 'alm85', 'alm86', 'alm89']);

function velojolToFeatureCollection(segments: VelojolSegment[]): FeatureCollection {
  const features = segments.map((seg) => ({
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
  const [bikeLanesGeo] = useState<FeatureCollection | null>(() => {
    if (!Array.isArray(almatySegments) || !almatySegments.length) return null;
    const segments = (almatySegments as VelojolSegment[]).filter(
      (seg) => !EXCLUDED_BIKE_LANE_IDS.has(seg.id)
    );
    return velojolToFeatureCollection(segments);
  });
  const [visibility, setVisibility] = useState<LayerVisibility>(loadStoredVisibility);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchMapPoints().then((rows) => {
        if (cancelled) return null;
        const fc = mapPointsToFeatureCollection(rows);
        setPointsGeo(fc);
        return fc;
      }),
      fetchMapRoutes().then((rows) => {
        if (cancelled) return null;
        const fc = mapRoutesToFeatureCollection(rows);
        setRoutesGeo(fc);
        return fc;
      }),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const fc =
        layer === 'points' || layer === 'sockets'
          ? pointsGeo
          : layer === 'routes'
            ? routesGeo
            : bikeLanesGeo;
      if (!fc) return null;
      const typeFilter = layer === 'points' ? 'point' : layer === 'sockets' ? 'socket' : null;
      const idNorm = String(id);
      return (
        fc.features.find(
          (f) =>
            String(f.properties.id) === idNorm && (typeFilter == null || f.properties.type === typeFilter)
        ) ?? null
      );
    },
    [pointsGeo, routesGeo, bikeLanesGeo]
  );

  return {
    pointsGeo,
    routesGeo,
    bikeLanesGeo,
    visibility,
    loading,
    toggleLayer,
    addLayersToMap,
    applyVisibility,
    getFeatureById,
  };
}
