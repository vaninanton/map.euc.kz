import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMapbox } from '@/hooks/useMapbox';
import { useLayers } from '@/hooks/useLayers';
import { useMapClick } from '@/hooks/useMapClick';
import { useMapHover } from '@/hooks/useMapHover';
import { useMapSelectionSync } from '@/hooks/useMapSelectionSync';
import { useSelectedFeatureState } from '@/hooks/useSelectedFeatureState';
import { useMapFeatureSelection } from '@/hooks/useMapFeatureSelection';
import { useDraftPointFlow } from '@/hooks/useDraftPointFlow';
import { useGeolocateControl } from '@/hooks/useGeolocateControl';
import { buildMapDeepLinkPath } from '@/utils/hashNav';
import type { HashFeatureType } from '@/utils/hashNav';
import { Marker } from 'mapbox-gl';
import { applySelectionOpacityById, type SelectedFeatureState } from '@/utils/selectionOpacity';
import { LayerControls } from '@/components/LayerControls';
import { AddPointPanel } from '@/components/AddPointPanel';
import { ProjectInfoModal } from '@/components/ProjectInfoModal';
import { MapFeatureInfoModal } from '@/components/MapFeatureInfoModal';
import { RouteListSidebar } from '@/components/RouteListSidebar';
import { PointListSidebar } from '@/components/PointListSidebar';
import { MapNotificationModals } from '@/components/MapNotificationModals';
import { RadarModal } from '@/components/RadarModal';
import { useTelegramAvatars } from '@/hooks/useTelegramAvatars';

export function EucMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResettingCache, setIsResettingCache] = useState(false);
  const [isProjectInfoOpen, setIsProjectInfoOpen] = useState(false);
  const [isRouteListOpen, setIsRouteListOpen] = useState(false);
  const [isPointListOpen, setIsPointListOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const draftMarkerRef = useRef<Marker | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isRadarOpen = location.pathname === '/radar';
  const clearMapSelectionUrl = useCallback(() => {
    void navigate('/', { replace: true });
  }, [navigate]);

  const syncSelectionUrl = useCallback(
    (type: HashFeatureType, id: string) => {
      void navigate(`/${buildMapDeepLinkPath(type, id)}`, { replace: true });
    },
    [navigate],
  );

  const { map, isMapReady, baseStyle, setBaseMapStyle, flyTo, flyToBounds } = useMapbox(containerRef);
  const { locationErrorMessage, clearLocationError } = useGeolocateControl(map, isMapReady);
  const {
    visibility,
    toggleLayer,
    setLayerVisibility,
    addLayersToMap,
    applyVisibility,
    getFeatureById,
    pointsGeo,
    routesGeo,
    bikeLanesGeo,
    telegramLatestGeo,
    telegramUsersGeo,
    errorMessage,
    emptyMessage,
    loading,
  } = useLayers();
  useTelegramAvatars(map, telegramLatestGeo);

  const {
    selectedFeature,
    selectedFeatureState,
    clearSelection,
    openFeature,
    handleFeatureSelect,
    displaySelectedFeature,
  } = useMapFeatureSelection({
    getFeatureById,
    flyTo,
    flyToBounds,
  });

  const {
    isAddingPoint,
    draftCoordinates,
    setDraftCoordinates,
    isSubmittingDraft,
    draftSubmitError,
    draftSubmitSuccess,
    clearDraftSubmitError,
    handleCancelAddPoint,
    handleToggleAddPoint,
    handleSubmitDraft,
  } = useDraftPointFlow(clearSelection, clearMapSelectionUrl);

  const handleSidebarClose = useCallback(() => {
    clearSelection();
    clearMapSelectionUrl();
  }, [clearSelection, clearMapSelectionUrl]);

  const handleToggleRadar = useCallback(() => {
    void navigate(isRadarOpen ? '/' : '/radar');
  }, [navigate, isRadarOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleMediaChange = () => { setIsDesktop(mediaQuery.matches); };
    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => { mediaQuery.removeEventListener('change', handleMediaChange); };
  }, []);

  useEffect(() => {
    if (!selectedFeature && !isRouteListOpen && !isPointListOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedFeature) {
          handleSidebarClose();
        } else if (isRouteListOpen) {
          setIsRouteListOpen(false);
        } else if (isPointListOpen) {
          setIsPointListOpen(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedFeature, isRouteListOpen, isPointListOpen, handleSidebarClose]);

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
  }, [addLayersToMap]);
  useEffect(() => {
    applyVisibilityRef.current = applyVisibility;
  }, [applyVisibility]);
  useEffect(() => {
    selectedFeatureStateRef.current = selectedFeatureState;
  }, [selectedFeatureState]);

  useMapClick(map, {
    enabled: !isAddingPoint,
    getFeatureById,
    onFeatureSelect: handleFeatureSelect,
    syncSelectionUrl,
  });
  useMapHover(map);

  useEffect(() => {
    if (!map || !isAddingPoint) return;

    const onMapClick = (event: { lngLat: { lng: number; lat: number } }) => {
      setDraftCoordinates([event.lngLat.lng, event.lngLat.lat]);
      clearDraftSubmitError();
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [map, isAddingPoint, setDraftCoordinates, clearDraftSubmitError]);

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

  // ПКМ по карте — координаты в консоль (только в dev)
  useEffect(() => {
    if (!import.meta.env.DEV || !map) return;
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
  }, [visibility, map, applyVisibility]);

  useMapSelectionSync({
    enabled: Boolean(map && isMapReady),
    getFeatureById,
    openFeature,
    ensureLayerVisible: (layerKey) => {
      setLayerVisibility(layerKey, true);
    },
  });

  return (
    <div>
      <div ref={containerRef} className="map-container" />
      {!import.meta.env.VITE_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-700 p-6 text-center z-10 rounded-2xl overlay-safe-inset font-medium">
          Задайте VITE_MAPBOX_TOKEN в .env
        </div>
      )}
      <MapNotificationModals
        errorMessage={errorMessage}
        emptyMessage={emptyMessage}
        loading={loading}
        draftSubmitSuccess={draftSubmitSuccess}
        locationErrorMessage={locationErrorMessage}
        isResettingCache={isResettingCache}
        onResetCacheAndReload={() => {
          void handleResetCacheAndReload();
        }}
        onCloseLocationError={clearLocationError}
      />
      {(!selectedFeature || isDesktop) && (
        <LayerControls
          map={map}
          isMapReady={isMapReady}
          visibility={visibility}
          onToggle={toggleLayer}
          baseStyle={baseStyle}
          onToggleBaseStyle={() => { setBaseMapStyle(baseStyle === 'satellite' ? 'streets' : 'satellite') }}
          isAddingPoint={isAddingPoint}
          onToggleAddPoint={() => {
            handleToggleAddPoint();
            if (!isAddingPoint) {
              setIsRouteListOpen(false);
              setIsPointListOpen(false);
            }
          }}
          isRadarOpen={isRadarOpen}
          onToggleRadar={handleToggleRadar}
          onOpenProjectInfo={() => {
            setIsProjectInfoOpen(true);
          }}
          isRouteListOpen={isRouteListOpen}
          onToggleRouteList={() => {
            setIsRouteListOpen((prev) => !prev);
            if (!isRouteListOpen) {
              setIsPointListOpen(false);
              if (isAddingPoint) handleCancelAddPoint();
            }
          }}
          isPointListOpen={isPointListOpen}
          onTogglePointList={() => {
            setIsPointListOpen((prev) => !prev);
            if (!isPointListOpen) {
              setIsRouteListOpen(false);
              if (isAddingPoint) handleCancelAddPoint();
            }
          }}
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
      <MapFeatureInfoModal feature={displaySelectedFeature} onClose={handleSidebarClose} />
      {isRouteListOpen && (
        <RouteListSidebar
          isOpen={isRouteListOpen}
          onClose={() => {
            setIsRouteListOpen(false);
          }}
          routesGeo={routesGeo}
          syncSelectionUrl={syncSelectionUrl}
          selectedRouteId={selectedFeature?.properties.type === 'route' ? selectedFeature.properties.id : undefined}
          isDesktop={isDesktop}
        />
      )}
      {isPointListOpen && (
        <PointListSidebar
          isOpen={isPointListOpen}
          onClose={() => {
            setIsPointListOpen(false);
          }}
          pointsGeo={pointsGeo}
          syncSelectionUrl={syncSelectionUrl}
          selectedPointId={
            selectedFeature?.properties.type === 'point' || selectedFeature?.properties.type === 'socket'
              ? selectedFeature.properties.id
              : undefined
          }
          isDesktop={isDesktop}
        />
      )}
      <ProjectInfoModal
        isOpen={isProjectInfoOpen}
        onClose={() => {
          setIsProjectInfoOpen(false);
        }}
        onClearCache={() => {
          void handleResetCacheAndReload();
        }}
      />
      <RadarModal
        isOpen={isRadarOpen}
        onClose={() => {
          void navigate('/', { replace: true });
        }}
        telegramUsersGeo={telegramLatestGeo}
        pointsGeo={pointsGeo}
        onSelectRider={(telegramUserId) => {
          const feature = getFeatureById('telegramUsers', `telegram-user-${String(telegramUserId)}`);
          if (!feature) return;
          openFeature(feature, 'telegramUsers');
        }}
      />
    </div>
  );
}
