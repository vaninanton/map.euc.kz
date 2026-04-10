import { useEffect, useRef } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { CLICKABLE_LAYER_IDS, LAYER_ID_TO_SOURCE } from '@/constants';

const TOOLTIP_OFFSET = 12;

/** Курсор pointer, подсветка при наведении (feature-state hover) и тултип с названием. */
export function useMapHover(map: MapboxMap | null) {
  const hoveredRef = useRef<{ sourceId: string; id: string | number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();
    let tooltipEl = tooltipRef.current;
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'map-hover-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      tooltipEl.style.display = 'none';
      container.style.position = 'relative';
      container.appendChild(tooltipEl);
      tooltipRef.current = tooltipEl;
    }

    const showTooltip = (x: number, y: number, name: string) => {
      tooltipEl.textContent = name || 'Без названия';
      tooltipEl.style.display = 'block';
      const leftPx = x + TOOLTIP_OFFSET;
      const topPx = y + TOOLTIP_OFFSET;
      tooltipEl.style.left = `${String(leftPx)}px`;
      tooltipEl.style.top = `${String(topPx)}px`;
    };

    const hideTooltip = () => {
      tooltipEl.style.display = 'none';
    };

    const clearHover = () => {
      const prev = hoveredRef.current;
      if (prev) {
        try {
          map.removeFeatureState({ source: prev.sourceId, id: prev.id }, 'hover');
        } catch {
          // слой/источник мог смениться
        }
        hoveredRef.current = null;
      }
      map.getCanvas().style.cursor = '';
      hideTooltip();
    };

    const handleMouseMove = (e: MapMouseEvent) => {
      const layers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      if (!layers.length) {
        clearHover();
        return;
      }
      const features = map.queryRenderedFeatures(e.point, { layers: [...layers] });
      if (features.length === 0) {
        clearHover();
        return;
      }
      const f = features[0] as GeoJSON.Feature & { layer?: { id?: string }; id?: string | number };
      const layerId = f.layer?.id;
      const props = f.properties as { id?: string; name?: string };
      const featureId = f.id ?? props.id;
      const sourceId = layerId ? LAYER_ID_TO_SOURCE[layerId] : undefined;
      const name = props.name ?? '';

      const prev = hoveredRef.current;
      if (prev && (prev.sourceId !== sourceId || prev.id !== featureId)) {
        try {
          map.removeFeatureState({ source: prev.sourceId, id: prev.id }, 'hover');
        } catch {
          // ignore
        }
        hoveredRef.current = null;
      }
      if (sourceId != null && featureId != null) {
        try {
          map.setFeatureState({ source: sourceId, id: featureId }, { hover: true });
          hoveredRef.current = { sourceId, id: featureId };
        } catch {
          // ignore
        }
        map.getCanvas().style.cursor = 'pointer';
        showTooltip(e.point.x, e.point.y, name);
      } else {
        map.getCanvas().style.cursor = '';
        hideTooltip();
      }
    };

    const handleMouseLeave = () => {
      clearHover();
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', handleMouseLeave);
    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseleave', handleMouseLeave);
      clearHover();
      if (tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
      tooltipRef.current = null;
    };
  }, [map]);
}
