import { useEffect, useRef } from 'react';
import { parseHash, HASH_TYPE_TO_LAYER_KEY } from '@/utils/hashNav';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';

interface UseHashSelectionSyncOptions {
  enabled: boolean;
  getFeatureById: (layer: LayerKey, id: string) => Feature | null;
  openFeature: (feature: Feature, layerKey: LayerKey) => void;
}

export function useHashSelectionSync(options: UseHashSelectionSyncOptions) {
  const { enabled, getFeatureById, openFeature } = options;
  const lastSyncedHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

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
  }, [enabled, getFeatureById, openFeature]);
}
