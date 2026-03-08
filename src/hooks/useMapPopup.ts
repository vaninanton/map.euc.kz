import { useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import React from 'react';
import mapboxgl from 'mapbox-gl';
import { PopupContent } from '@/components/PopupContent';
import type { Feature } from '@/types/geojson';

export interface UseMapPopupOptions {
  /** Вызывается при закрытии popup (пользователем или программно). */
  onClose: () => void;
}

export function useMapPopup(
  map: mapboxgl.Map | null,
  options: UseMapPopupOptions
) {
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const onCloseRef = useRef(options.onClose);
  const skipOnCloseRef = useRef(false);
  const pendingRafRef = useRef<number | null>(null);
  const pendingRootRef = useRef<{ unmount: () => void } | null>(null);

  useEffect(() => {
    onCloseRef.current = options.onClose;
  }, [options.onClose]);

  useEffect(() => {
    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, [map]);

  const closePopup = useCallback((options?: { skipOnClose?: boolean }) => {
    if (options?.skipOnClose) skipOnCloseRef.current = true;
    popupRef.current?.remove();
    popupRef.current = null;
  }, []);

  const openPopup = useCallback(
    (feature: Feature, lngLat: [number, number]) => {
      if (!map) return;
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
        pendingRootRef.current?.unmount();
        pendingRootRef.current = null;
      }
      popupRef.current?.remove();
      const div = document.createElement('div');
      div.style.paddingRight = '28px'; // место под кнопку закрытия Mapbox
      const root = createRoot(div);
      flushSync(() => {
        root.render(React.createElement(PopupContent, { feature }));
      });
      const popup = new mapboxgl.Popup({ offset: 15, closeButton: true })
        .setLngLat(lngLat)
        .setDOMContent(div);
      pendingRootRef.current = root;
      popup.on('close', () => {
        popupRef.current = null;
        const wasSkip = skipOnCloseRef.current;
        if (wasSkip) skipOnCloseRef.current = false;
        queueMicrotask(() => {
          root.unmount();
          if (!wasSkip) onCloseRef.current();
        });
      });
      // Добавляем popup в следующем кадре, чтобы не дрожала карта (flyTo и addTo в одном кадре)
      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = null;
        pendingRootRef.current = null;
        popup.addTo(map);
        popupRef.current = popup;
      });
    },
    [map]
  );

  return { openPopup, closePopup };
}
