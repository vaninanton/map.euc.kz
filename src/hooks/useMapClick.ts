import { useEffect } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { CLICKABLE_LAYER_IDS, LAYER_ID_TO_KEY } from '@/constants';
import { LAYER_KEY_TO_HASH_TYPE } from '@/utils/hashNav';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import type { HashFeatureType } from '@/utils/hashNav';

export interface UseMapClickOptions {
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
  const { getFeatureById, onFeatureSelect, setHash } = options;

  useEffect(() => {
    if (!map) return;

    const handleClick = (e: MapMouseEvent) => {
      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      if (!existingLayers.length) return;
      const features = map.queryRenderedFeatures(e.point, { layers: existingLayers });
      if (!features.length) return;
      const f = features[0] as GeoJSON.Feature & {
        layer?: { id?: string };
        properties?: Record<string, unknown>;
      };
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Mapbox feature/layerId не гарантированы в queryRenderedFeatures */
      const layerId = f.layer?.id;
      const id = (f.properties as { id?: string })?.id;
      if (!id || !layerId) return;
      const layerKey = LAYER_ID_TO_KEY[layerId];
      if (!layerKey) return;
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
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
  }, [map, getFeatureById, onFeatureSelect, setHash]);
}
