import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useMapbox } from '@/hooks/useMapbox';
import { useLayers } from '@/hooks/useLayers';
import { useMapClick } from '@/hooks/useMapClick';
import { useMapHover } from '@/hooks/useMapHover';
import { getFeatureBounds, getFeatureCenter } from '@/utils/bounds';
import { MAP_ZOOM_FOCUS, LAYER_IDS, LAYER_ID_TO_SOURCE, SOURCE_IDS } from '@/constants';
import { parseHash, setHash, clearHash, HASH_TYPE_TO_LAYER_KEY } from '@/utils/hashNav';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import { FeatureSidebar } from '@/components/FeatureSidebar';
import { LayerControls } from '@/components/LayerControls';

const LINE_LAYERS: LayerKey[] = ['routes', 'bikeLanes'];

const ALL_SOURCE_IDS = [SOURCE_IDS.points, SOURCE_IDS.routes, SOURCE_IDS.bikeLanes] as const;

function isLineLayer(layerKey: LayerKey): layerKey is 'routes' | 'bikeLanes' {
  return LINE_LAYERS.includes(layerKey);
}

type SelectedFeatureState = { sourceId: string; id: string } | null;

export function EucMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [selectedFeatureState, setSelectedFeatureState] = useState<SelectedFeatureState>(null);
  const [isResettingCache, setIsResettingCache] = useState(false);

  const { map, isMapReady, baseStyle, setBaseMapStyle, flyTo, flyToBounds } = useMapbox(containerRef);
  const {
    visibility,
    toggleLayer,
    addLayersToMap,
    applyVisibility,
    getFeatureById,
    pointsGeo,
    routesGeo,
    bikeLanesGeo,
    errorMessage,
  } = useLayers();

  const handleSidebarClose = useCallback(() => {
    setSelectedFeature(null);
    setSelectedFeatureState(null);
    clearHash();
  }, []);

  const handleResetCacheAndReload = useCallback(async () => {
    if (isResettingCache) return;
    setIsResettingCache(true);

    try {
      localStorage.clear();

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch (error) {
      console.error('Не удалось полностью очистить кеш:', error);
    } finally {
      window.location.reload();
    }
  }, [isResettingCache]);

  const addLayersRef = useRef(addLayersToMap);
  const applyVisibilityRef = useRef(applyVisibility);
  const selectedFeatureStateRef = useRef<SelectedFeatureState>(null);
  useEffect(() => {
    addLayersRef.current = addLayersToMap;
    applyVisibilityRef.current = applyVisibility;
    selectedFeatureStateRef.current = selectedFeatureState;
  });

  const openFeature = useCallback(
    (feature: Feature, layerKey: LayerKey, lngLat?: [number, number]) => {
      const sourceId = LAYER_ID_TO_SOURCE[LAYER_IDS[layerKey]];
      const id = feature.properties.id;
      setSelectedFeatureState(sourceId ? { sourceId, id } : null);
      setSelectedFeature(feature);
      if (isLineLayer(layerKey)) {
        flyToBounds(getFeatureBounds(feature));
      } else {
        const center = lngLat ?? getFeatureCenter(feature);
        flyTo(center, MAP_ZOOM_FOCUS);
      }
    },
    [flyTo, flyToBounds]
  );

  const handleFeatureSelect = useCallback(
    (feature: Feature, layerKey: LayerKey, lngLat: [number, number]) => {
      openFeature(feature, layerKey, lngLat);
    },
    [openFeature]
  );

  useMapClick(map, { getFeatureById, onFeatureSelect: handleFeatureSelect, setHash });
  useMapHover(map);

  // ПКМ по карте — вывести координаты в консоль
  useEffect(() => {
    if (!map) return;
    const onContextMenu = (e: { lngLat: { lng: number; lat: number } }) => {
      const { lng, lat } = e.lngLat;
      console.log('Координаты (lng, lat):', lng, lat, [lng, lat]);
    };
    map.on('contextmenu', onContextMenu);
    return () => {
      map.off('contextmenu', onContextMenu);
    };
  }, [map]);

  // Синхронизация подсветки: выбранный — opacity 1, все остальные на карте — selected: false (полупрозрачны)
  const selectedRef = useRef<SelectedFeatureState>(null);
  const sourceToFeatures = useMemo(
    () => ({
      [SOURCE_IDS.points]: pointsGeo?.features.map((f) => f.properties.id) ?? [],
      [SOURCE_IDS.routes]: routesGeo?.features.map((f) => f.properties.id) ?? [],
      [SOURCE_IDS.bikeLanes]: bikeLanesGeo?.features.map((f) => f.properties.id) ?? [],
    }),
    [pointsGeo, routesGeo, bikeLanesGeo]
  );
  useEffect(() => {
    if (!map) return;
    const prev = selectedRef.current;
    if (prev) {
      try {
        for (const sourceId of ALL_SOURCE_IDS) {
          const ids = sourceToFeatures[sourceId];
          for (const id of ids) {
            map.removeFeatureState({ source: sourceId, id }, 'selected');
          }
        }
      } catch {
        // ignore
      }
      selectedRef.current = null;
    }
    if (selectedFeatureState) {
      const { sourceId: selectedSourceId, id: selectedId } = selectedFeatureState;
      const selectedNorm = String(selectedId);
      try {
        for (const sourceId of ALL_SOURCE_IDS) {
          const ids = sourceToFeatures[sourceId];
          for (const id of ids) {
            const isSelected = sourceId === selectedSourceId && String(id) === selectedNorm;
            map.setFeatureState({ source: sourceId, id }, { selected: isSelected });
          }
        }
        selectedRef.current = selectedFeatureState;
      } catch {
        // источник ещё не загружен
      }
    }
  }, [map, selectedFeatureState, sourceToFeatures]);

  useEffect(() => {
    if (!map || !isMapReady) return;
    addLayersToMap(map);
    applyVisibility(map);
  }, [map, isMapReady, addLayersToMap, applyVisibility, pointsGeo, routesGeo]);

  useEffect(() => {
    if (!map) return;
    const onStyleLoad = () => {
      addLayersRef.current(map);
      applyVisibilityRef.current(map);
      const sel = selectedFeatureStateRef.current;
      if (sel) {
        try {
          map.setFeatureState({ source: sel.sourceId, id: sel.id }, { selected: true });
        } catch {
          // ignore
        }
      }
    };
    map.on('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [map]);

  useEffect(() => {
    applyVisibility(map);
  }, [visibility, map, applyVisibility]);

  // Открытие по hash только при смене hash (или первая загрузка), чтобы не сбрасывать зум при ре-рендерах
  const lastSyncedHashRef = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !isMapReady) return;
    const syncFromHash = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash === lastSyncedHashRef.current) return;
      const parsed = parseHash();
      if (!parsed) {
        lastSyncedHashRef.current = hash;
        return;
      }
      const layerKey = HASH_TYPE_TO_LAYER_KEY[parsed.type];
      const feature = getFeatureById(layerKey, parsed.id);
      if (!feature) return;
      requestAnimationFrame(() => {
        openFeature(feature, layerKey);
      });
      lastSyncedHashRef.current = hash;
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, [map, isMapReady, pointsGeo, routesGeo, getFeatureById, openFeature]);

  return (
    <div>
      <div ref={containerRef} className="map-container" />
      {!import.meta.env.VITE_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-700 p-6 text-center z-10 rounded-2xl overlay-safe-inset font-medium">
          Задайте VITE_MAPBOX_TOKEN в .env
        </div>
      )}
      {errorMessage && (
        <div className="absolute top-0 left-1/2 z-20 flex max-w-100 -translate-x-1/2 items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-md overlay-safe-inset">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              void handleResetCacheAndReload();
            }}
            disabled={isResettingCache}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            Обновить страницу
          </button>
        </div>
      )}
      <LayerControls
        visibility={visibility}
        onToggle={toggleLayer}
        baseStyle={baseStyle}
        onBaseStyleChange={setBaseMapStyle}
      />
      {selectedFeature && (
        <FeatureSidebar
          feature={selectedFeature}
          onClose={handleSidebarClose}
        />
      )}
    </div>
  );
}
