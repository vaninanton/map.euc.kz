import { useEffect, useState, useCallback, useRef } from 'react';
import type { Feature, FeatureCollection, BikeLaneFeature } from '@/types/geojson';
import type { VelojolSegment } from '@/types/velojol';
import { fetchMapPoints, fetchMapRoutes, fetchTelegramLocations, supabase } from '@/lib/supabase';
import {
  mapPointsToFeatureCollection,
  mapRoutesToFeatureCollection,
  telegramLocationsToRecentTracksFeatureCollection,
  telegramLocationsToUsersFeatureCollection,
} from '@/utils/supabaseToGeojson';
import { addLayersToMap as addLayersToMapImpl } from '@/lib/mapLayers';
import { LAYER_IDS, type LayerKey } from '@/constants';
import type { Map as MapboxMap } from 'mapbox-gl';
import { useLayerVisibilityStore } from '@/hooks/useLayerVisibilityStore';
import { useFeatureIndexes } from '@/hooks/useFeatureIndexes';
import { useTelegramRealtime } from '@/hooks/useTelegramRealtime';

export type { LayerKey };

export interface LayerVisibility {
  points: boolean;
  sockets: boolean;
  routes: boolean;
  bikeLanes: boolean;
  telegramUsers: boolean;
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
  const [telegramUsersGeo, setTelegramUsersGeo] = useState<FeatureCollection | null>(null);
  const { visibility, toggleLayer } = useLayerVisibilityStore();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const telegramRefreshSeqRef = useRef(0);
  const refreshTimerIdRef = useRef<number | null>(null);

  const refreshTelegramUsers = useCallback(async () => {
    const requestSeq = ++telegramRefreshSeqRef.current;
    try {
      const rows = await fetchTelegramLocations();
      if (requestSeq !== telegramRefreshSeqRef.current) return;
      const pointsGeo = telegramLocationsToUsersFeatureCollection(rows);
      const tracksGeo = telegramLocationsToRecentTracksFeatureCollection(rows);
      setTelegramUsersGeo({
        type: 'FeatureCollection',
        features: [...tracksGeo.features, ...pointsGeo.features],
      });
    } catch (error) {
      console.error('Realtime refresh telegram users failed:', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    setEmptyMessage(null);
    void (async () => {
      const [pointsResult, routesResult, telegramLocationsResult, bikeLanesModule] = await Promise.allSettled([
        fetchMapPoints(),
        fetchMapRoutes(),
        fetchTelegramLocations(),
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

      if (telegramLocationsResult.status === 'fulfilled') {
        const pointsGeo = telegramLocationsToUsersFeatureCollection(telegramLocationsResult.value);
        const tracksGeo = telegramLocationsToRecentTracksFeatureCollection(telegramLocationsResult.value);
        setTelegramUsersGeo({
          type: 'FeatureCollection',
          features: [...tracksGeo.features, ...pointsGeo.features],
        });
      } else {
        setTelegramUsersGeo(null);
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
      if (telegramLocationsResult.status === 'rejected') {
        const msg =
          telegramLocationsResult.reason instanceof Error
            ? telegramLocationsResult.reason.message
            : 'Не удалось загрузить Telegram-участников.';
        errors.push(msg);
      }
      if (errors.length > 0) setErrorMessage(errors.join(' '));

      const pointsCount = pointsResult.status === 'fulfilled' ? pointsResult.value.length : 0;
      const routesCount = routesResult.status === 'fulfilled' ? routesResult.value.length : 0;
      const telegramPointsCount =
        telegramLocationsResult.status === 'fulfilled' ? telegramLocationsResult.value.length : 0;
      if (pointsCount + routesCount + telegramPointsCount === 0) {
        setEmptyMessage('Пока нет опубликованных точек, маршрутов и Telegram-локаций.');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (refreshTimerIdRef.current !== null) {
      window.clearTimeout(refreshTimerIdRef.current);
    }
    refreshTimerIdRef.current = window.setTimeout(() => {
      void refreshTelegramUsers();
    }, 300);
  }, [refreshTelegramUsers]);

  useTelegramRealtime(supabase, scheduleRealtimeRefresh);

  useEffect(() => {
    return () => {
      if (refreshTimerIdRef.current !== null) {
        window.clearTimeout(refreshTimerIdRef.current);
      }
    };
  }, []);

  const { pointsById, routesById, bikeLanesById, telegramUsersById } = useFeatureIndexes(
    pointsGeo,
    routesGeo,
    bikeLanesGeo,
    telegramUsersGeo
  );

  const addLayersToMap = useCallback(
    (map: MapboxMap) => {
      addLayersToMapImpl(map, {
        pointsGeo,
        routesGeo,
        bikeLanesGeo,
        telegramUsersGeo,
        visibility,
      });
    },
    [pointsGeo, routesGeo, bikeLanesGeo, telegramUsersGeo, visibility]
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
      setVis(LAYER_IDS.telegramUsers, visibility.telegramUsers);
      setVis(LAYER_IDS.telegramTracks, visibility.telegramUsers);
    },
    [visibility]
  );

  const getFeatureById = useCallback(
    (layer: LayerKey, id: string): Feature | null => {
      const idNorm = String(id);
      if (layer === 'points') return pointsById.get(`point:${idNorm}`) ?? null;
      if (layer === 'sockets') return pointsById.get(`socket:${idNorm}`) ?? null;
      if (layer === 'routes') return routesById.get(idNorm) ?? null;
      if (layer === 'bikeLanes') return bikeLanesById.get(idNorm) ?? null;
      return telegramUsersById.get(idNorm) ?? null;
    },
    [pointsById, routesById, bikeLanesById, telegramUsersById]
  );

  return {
    pointsGeo,
    routesGeo,
    bikeLanesGeo,
    telegramUsersGeo,
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
