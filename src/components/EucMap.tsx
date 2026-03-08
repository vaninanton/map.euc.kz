import { useEffect, useRef, useCallback, useState } from 'react';
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

function isLineLayer(layerKey: LayerKey): layerKey is 'routes' | 'bikeLanes' {
  return LINE_LAYERS.includes(layerKey);
}

type SelectedFeatureState = { sourceId: string; id: string } | null;

export function EucMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [selectedFeatureState, setSelectedFeatureState] = useState<SelectedFeatureState>(null);

  const { map, isMapReady, baseStyle, setBaseMapStyle, flyTo, flyToBounds } = useMapbox(containerRef);
  const { visibility, toggleLayer, addLayersToMap, applyVisibility, getFeatureById, pointsGeo, routesGeo, bikeLanesGeo } = useLayers();

  const handleSidebarClose = useCallback(() => {
    setSelectedFeature(null);
    setSelectedFeatureState(null);
    clearHash();
  }, []);

  const addLayersRef = useRef(addLayersToMap);
  const applyVisibilityRef = useRef(applyVisibility);
  const selectedFeatureStateRef = useRef<SelectedFeatureState>(null);
  addLayersRef.current = addLayersToMap;
  applyVisibilityRef.current = applyVisibility;
  selectedFeatureStateRef.current = selectedFeatureState;

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
  const sourceToFeatures: Record<string, string[]> = {
    [SOURCE_IDS.points]: pointsGeo?.features.map((f) => String(f.properties.id)) ?? [],
    [SOURCE_IDS.routes]: routesGeo?.features.map((f) => String(f.properties.id)) ?? [],
    [SOURCE_IDS.bikeLanes]: bikeLanesGeo?.features.map((f) => String(f.properties.id)) ?? [],
  };
  const allSourceIds = [SOURCE_IDS.points, SOURCE_IDS.routes, SOURCE_IDS.bikeLanes];
  useEffect(() => {
    if (!map) return;
    const prev = selectedRef.current;
    if (prev) {
      try {
        for (const sourceId of allSourceIds) {
          const ids = sourceToFeatures[sourceId] ?? [];
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
      const idStr = String(selectedId);
      try {
        for (const sourceId of allSourceIds) {
          const ids = sourceToFeatures[sourceId] ?? [];
          for (const id of ids) {
            const isSelected = sourceId === selectedSourceId && id === idStr;
            map.setFeatureState({ source: sourceId, id }, { selected: isSelected });
          }
        }
        selectedRef.current = selectedFeatureState;
      } catch {
        // источник ещё не загружен
      }
    }
  }, [map, selectedFeatureState, pointsGeo, routesGeo, bikeLanesGeo]);

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
      requestAnimationFrame(() => openFeature(feature, layerKey));
      lastSyncedHashRef.current = hash;
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [map, isMapReady, pointsGeo, routesGeo, getFeatureById, openFeature]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {!import.meta.env.VITE_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-700 p-6 text-center z-10 rounded-2xl overlay-safe-inset font-medium">
          Задайте VITE_MAPBOX_TOKEN в .env
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
