import { useEffect, useRef } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { CLICKABLE_LAYER_IDS } from '@/constants';
import { getSourceIdByLayerId, getStringProperty } from '@/utils/mapFeatureGuards';

const TOOLTIP_OFFSET = 12;

/** Курсор pointer, подсветка при наведении (feature-state hover) и тултип с названием. */
export function useMapHover(map: MapboxMap | null) {
  const hoveredRef = useRef<{ sourceId: string; id: string | number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingEventRef = useRef<MapMouseEvent | null>(null);

  useEffect(() => {
    if (!map) return;
    const supportsHover =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
        : !('ontouchstart' in window);
    if (!supportsHover) return;

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

    const setCanvasCursor = (value: string) => {
      const canvas = map.getCanvas();
      if (!canvas) return;
      canvas.style.cursor = value;
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
      setCanvasCursor('');
      hideTooltip();
    };

    const processMouseMove = (e: MapMouseEvent) => {
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
      const f = features[0];
      const layerId = f.layer?.id;
      const featureId = f.id ?? getStringProperty(f.properties, 'id');
      const sourceId = layerId ? getSourceIdByLayerId(layerId) ?? undefined : undefined;
      const name = getStringProperty(f.properties, 'name') ?? '';

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
        setCanvasCursor('pointer');
        showTooltip(e.point.x, e.point.y, name);
      } else {
        setCanvasCursor('');
        hideTooltip();
      }
    };

    const handleMouseMove = (e: MapMouseEvent) => {
      pendingEventRef.current = e;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingEventRef.current;
        if (!pending) return;
        processMouseMove(pending);
      });
    };

    const handleMouseLeave = () => {
      clearHover();
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', handleMouseLeave);
    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseleave', handleMouseLeave);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingEventRef.current = null;
      clearHover();
      if (tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
      tooltipRef.current = null;
    };
  }, [map]);
}
