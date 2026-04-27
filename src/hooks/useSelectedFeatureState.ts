import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

export interface SelectedFeatureState {
  sourceId: string;
  id: string;
}

export function useSelectedFeatureState(
  map: MapboxMap | null,
  selected: SelectedFeatureState | null
) {
  const prevRef = useRef<SelectedFeatureState | null>(null);

  useEffect(() => {
    if (!map) return;

    const prev = prevRef.current;
    if (prev) {
      try {
        map.removeFeatureState({ source: prev.sourceId, id: prev.id }, 'selected');
      } catch {
        // источник может быть пересоздан после style change
      }
    }

    if (selected) {
      try {
        map.setFeatureState({ source: selected.sourceId, id: selected.id }, { selected: true });
      } catch {
        // источник ещё не готов
      }
    }

    prevRef.current = selected;
  }, [map, selected]);
}
