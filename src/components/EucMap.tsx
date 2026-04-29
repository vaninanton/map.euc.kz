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
import { createMapPointDraft } from '@/lib/supabase';
import { Marker } from 'mapbox-gl';
import type { Feature } from '@/types/geojson';
import type { MapPointDraftInput } from '@/types';
import type { LayerKey } from '@/constants';
import { applySelectionOpacityById, type SelectedFeatureState } from '@/utils/selectionOpacity';
import { FeatureSidebar } from '@/components/FeatureSidebar';
import { LayerControls } from '@/components/LayerControls';
import { AddPointPanel } from '@/components/AddPointPanel';

const SIDEBAR_DESKTOP_WIDTH = 320;
const SIDEBAR_MOBILE_HEIGHT_RATIO = 0.45;
const FOCUS_PADDING_BASE = 40;

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
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [draftCoordinates, setDraftCoordinates] = useState<[number, number] | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [draftSubmitError, setDraftSubmitError] = useState<string | null>(null);
  const [draftSubmitSuccess, setDraftSubmitSuccess] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const draftMarkerRef = useRef<Marker | null>(null);

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
    telegramUsersGeo,
    errorMessage,
    emptyMessage,
    loading,
  } = useLayers();

  const handleSidebarClose = useCallback(() => {
    setSelectedFeature(null);
    setSelectedFeatureState(null);
    clearHash();
  }, []);

  const handleCancelAddPoint = useCallback(() => {
    setIsAddingPoint(false);
    setDraftCoordinates(null);
    setDraftSubmitError(null);
  }, []);

  const handleToggleAddPoint = useCallback(() => {
    setDraftSubmitSuccess(null);
    setDraftSubmitError(null);
    setSelectedFeature(null);
    setSelectedFeatureState(null);
    clearHash();
    setIsAddingPoint((prev) => !prev);
    setDraftCoordinates(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleMediaChange = () => {
      setIsDesktop(mediaQuery.matches);
    };

    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
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
      if (feature.geometry.type === 'LineString') {
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

  useMapClick(map, { enabled: !isAddingPoint, getFeatureById, onFeatureSelect: handleFeatureSelect, setHash });
  useMapHover(map);

  useEffect(() => {
    if (!selectedFeature || selectedFeature.properties.type !== 'telegramUser') return;
    const freshFeature = getFeatureById('telegramUsers', selectedFeature.properties.id);
    if (!freshFeature) return;
    setSelectedFeature(freshFeature);
  }, [selectedFeature, getFeatureById, telegramUsersGeo]);

  useEffect(() => {
    if (!map || !isAddingPoint) return;

    const onMapClick = (event: { lngLat: { lng: number; lat: number } }) => {
      setDraftCoordinates([event.lngLat.lng, event.lngLat.lat]);
      setDraftSubmitError(null);
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [map, isAddingPoint]);

  useEffect(() => {
    if (!map) return;

    if (!isAddingPoint || !draftCoordinates) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }

    if (!draftMarkerRef.current) {
      const markerEl = document.createElement('div');
      markerEl.setAttribute('aria-label', 'Выбранная точка');
      markerEl.style.width = '18px';
      markerEl.style.height = '18px';
      markerEl.style.borderRadius = '999px';
      markerEl.style.background = '#ef4444';
      markerEl.style.border = '3px solid #ffffff';
      markerEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';

      draftMarkerRef.current = new Marker({ element: markerEl, anchor: 'center' }).setLngLat(draftCoordinates).addTo(map);
    }

    draftMarkerRef.current.setLngLat(draftCoordinates);
  }, [map, isAddingPoint, draftCoordinates]);

  useEffect(() => {
    return () => {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
    };
  }, []);

  const handleSubmitDraft = useCallback(async (payload: MapPointDraftInput) => {
    if (isSubmittingDraft) return;
    setIsSubmittingDraft(true);
    setDraftSubmitError(null);
    setDraftSubmitSuccess(null);

    try {
      await createMapPointDraft(payload);
      setDraftSubmitSuccess('Заявка отправлена на модерацию.');
      setIsAddingPoint(false);
      setDraftCoordinates(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось отправить заявку. Попробуйте позже.';
      setDraftSubmitError(message);
    } finally {
      setIsSubmittingDraft(false);
    }
  }, [isSubmittingDraft]);

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
  }, [map, selectedFeatureState, pointsGeo, routesGeo, bikeLanesGeo, telegramUsersGeo]);

  useEffect(() => {
    if (!map || !isMapReady) return;
    addLayersToMap(map);
  }, [map, isMapReady, addLayersToMap, pointsGeo, routesGeo, bikeLanesGeo, telegramUsersGeo]);

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
  }, [visibility, map, applyVisibility, pointsGeo, routesGeo, bikeLanesGeo, telegramUsersGeo]);

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
      {draftSubmitSuccess && (
        <div className="absolute top-0 left-1/2 z-20 flex max-w-100 -translate-x-1/2 items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-md overlay-safe-inset">
          <span>{draftSubmitSuccess}</span>
        </div>
      )}
      {(!selectedFeature || isDesktop) && (
        <LayerControls
          visibility={visibility}
          onToggle={toggleLayer}
          baseStyle={baseStyle}
          onBaseStyleChange={setBaseMapStyle}
          isAddingPoint={isAddingPoint}
          onToggleAddPoint={handleToggleAddPoint}
        />
      )}
      {isAddingPoint && (
        <AddPointPanel
          coordinates={draftCoordinates}
          isSubmitting={isSubmittingDraft}
          submitError={draftSubmitError}
          onSubmit={handleSubmitDraft}
          onCancel={handleCancelAddPoint}
        />
      )}
      {selectedFeature && (
        <FeatureSidebar
          feature={selectedFeature}
          onClose={handleSidebarClose}
        />
      )}
    </div>
  );
}
