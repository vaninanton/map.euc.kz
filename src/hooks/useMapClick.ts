import { useEffect } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { CLICKABLE_LAYER_IDS } from '@/constants';
import { LAYER_KEY_TO_HASH_TYPE } from '@/utils/hashNav';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import type { HashFeatureType } from '@/utils/hashNav';
import { getLayerKeyById, getStringProperty } from '@/utils/mapFeatureGuards';

export interface UseMapClickOptions {
  enabled?: boolean;
  getFeatureById: (layer: LayerKey, id: string) => Feature | null;
  onFeatureSelect: (
    feature: Feature,
    layerKey: LayerKey,
    lngLat: [number, number]
  ) => void;
  setHash: (type: HashFeatureType, id: string) => void;
}

export function useMapClick(
  map: MapboxMap | null,
  options: UseMapClickOptions
) {
  const { enabled = true, getFeatureById, onFeatureSelect, setHash } = options;

  useEffect(() => {
    if (!map || !enabled) return;

    const handleClick = (e: MapMouseEvent) => {
      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      if (!existingLayers.length) return;
      const features = map.queryRenderedFeatures(e.point, { layers: existingLayers });
      if (!features.length) return;
      const f = features[0];
      const layerId = f.layer?.id;
      const id = getStringProperty(f.properties, 'id');
      if (!id || !layerId) return;
      const layerKey = getLayerKeyById(layerId);
      if (!layerKey) return;
      const feature = getFeatureById(layerKey, id);
      if (!feature) return;
      const lngLat =
        f.geometry.type === 'Point'
          ? (f.geometry.coordinates as [number, number])
          : e.lngLat.toArray();
      setHash(LAYER_KEY_TO_HASH_TYPE[layerKey], feature.properties.id);
      onFeatureSelect(feature, layerKey, lngLat);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, enabled, getFeatureById, onFeatureSelect, setHash]);
}
