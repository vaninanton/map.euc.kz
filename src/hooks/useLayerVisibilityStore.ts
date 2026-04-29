import { useCallback, useState } from 'react';
import { isRecord } from '@/utils/mapFeatureGuards';
import type { LayerVisibility } from '@/hooks/useLayers';

const STORAGE_KEY = 'map-euc-layer-visibility';

const DEFAULT_VISIBILITY: LayerVisibility = {
  points: true,
  sockets: true,
  routes: true,
  bikeLanes: true,
  telegramUsers: true,
};

function loadStoredVisibility(): LayerVisibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBILITY;
    const parsed: unknown = JSON.parse(raw);
    const source = isRecord(parsed) ? parsed : {};
    return {
      points: typeof source.points === 'boolean' ? source.points : DEFAULT_VISIBILITY.points,
      sockets: typeof source.sockets === 'boolean' ? source.sockets : DEFAULT_VISIBILITY.sockets,
      routes: typeof source.routes === 'boolean' ? source.routes : DEFAULT_VISIBILITY.routes,
      bikeLanes: typeof source.bikeLanes === 'boolean' ? source.bikeLanes : DEFAULT_VISIBILITY.bikeLanes,
      telegramUsers: typeof source.telegramUsers === 'boolean' ? source.telegramUsers : DEFAULT_VISIBILITY.telegramUsers,
    };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

export function useLayerVisibilityStore() {
  const [visibility, setVisibility] = useState<LayerVisibility>(loadStoredVisibility);

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setVisibility((current) => {
      const next = { ...current, [layer]: !current[layer] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { visibility, toggleLayer };
}
