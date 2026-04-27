import { useEffect, useRef, useCallback, useState } from 'react';
import { useMapbox } from '@/hooks/useMapbox';
import { useLayers } from '@/hooks/useLayers';
import { useMapClick } from '@/hooks/useMapClick';
import { useMapHover } from '@/hooks/useMapHover';
import { useHashSelectionSync } from '@/hooks/useHashSelectionSync';
import { useSelectedFeatureState } from '@/hooks/useSelectedFeatureState';
import { getFeatureBounds, getFeatureCenter } from '@/utils/bounds';
import { MAP_ZOOM_FOCUS, LAYER_IDS, LAYER_ID_TO_SOURCE } from '@/constants';
import { setHash, clearHash } from '@/utils/hashNav';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import { applySelectionOpacityById, type SelectedFeatureState } from '@/utils/selectionOpacity';
import { FeatureSidebar } from '@/components/FeatureSidebar';
import { LayerControls } from '@/components/LayerControls';

const LINE_LAYERS: LayerKey[] = ['routes', 'bikeLanes'];
const SIDEBAR_DESKTOP_WIDTH = 320;
const SIDEBAR_MOBILE_HEIGHT_RATIO = 0.45;
const FOCUS_PADDING_BASE = 40;

function isLineLayer(layerKey: LayerKey): layerKey is 'routes' | 'bikeLanes' {
  return LINE_LAYERS.includes(layerKey);
}

function getRouteFocusPadding(): number | { top: number; right: number; bottom: number; left: number } {
  if (typeof window === 'undefined') return FOCUS_PADDING_BASE;

  const isDesktop = window.matchMedia('(min-width: 768px)').matches;
  if (isDesktop) {
    return {
      top: FOCUS_PADDING_BASE,
      right: SIDEBAR_DESKTOP_WIDTH + FOCUS_PADDING_BASE,
      bottom: FOCUS_PADDING_BASE,
      left: FOCUS_PADDING_BASE,
    };
  }

  const viewportHeight = window.innerHeight || 0;
  const mobileSidebarHeight = Math.round(viewportHeight * SIDEBAR_MOBILE_HEIGHT_RATIO);
  return {
    top: FOCUS_PADDING_BASE,
    right: FOCUS_PADDING_BASE,
    bottom: mobileSidebarHeight + FOCUS_PADDING_BASE,
    left: FOCUS_PADDING_BASE,
  };
}

export function EucMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [selectedFeatureState, setSelectedFeatureState] = useState<SelectedFeatureState | null>(null);
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
    emptyMessage,
    loading,
  } = useLayers();

  const handleSidebarClose = useCallback(() => {
    setSelectedFeature(null);
    setSelectedFeatureState(null);
    clearHash();
  }, []);

  useEffect(() => {
    if (!selectedFeature) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleSidebarClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedFeature, handleSidebarClose]);

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
  const selectedFeatureStateRef = useRef<SelectedFeatureState | null>(null);
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
        flyToBounds(getFeatureBounds(feature), { padding: getRouteFocusPadding() });
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

  useSelectedFeatureState(map, selectedFeatureState);

  useEffect(() => {
    applySelectionOpacityById(map, selectedFeatureState);
  }, [map, selectedFeatureState, pointsGeo, routesGeo, bikeLanesGeo]);

  useEffect(() => {
    if (!map || !isMapReady) return;
    addLayersToMap(map);
  }, [map, isMapReady, addLayersToMap, pointsGeo, routesGeo, bikeLanesGeo]);

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
      applySelectionOpacityById(map, sel);
    };
    map.on('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [map]);

  useEffect(() => {
    applyVisibility(map);
  }, [visibility, map, applyVisibility]);

  useHashSelectionSync({
    enabled: Boolean(map && isMapReady),
    getFeatureById,
    openFeature,
  });

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
      {!errorMessage && !loading && emptyMessage && (
        <div className="absolute top-0 left-1/2 z-20 flex max-w-100 -translate-x-1/2 items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 shadow-md overlay-safe-inset">
          <span>{emptyMessage}</span>
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
