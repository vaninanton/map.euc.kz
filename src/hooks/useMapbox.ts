import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAP_CENTER, MAP_ZOOM_DEFAULT, MAPBOX_STYLES } from '@/constants';

const token = import.meta.env.VITE_MAPBOX_TOKEN;

const STORAGE_KEY = 'map-base-style';
function isBaseMapStyle(value: string): value is BaseMapStyle {
  return value in MAPBOX_STYLES;
}

function getStoredStyle(): BaseMapStyle {
  if (typeof window === 'undefined') return 'streets';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isBaseMapStyle(stored)) return stored;
  return 'streets';
}

export type BaseMapStyle = keyof typeof MAPBOX_STYLES;

export function useMapbox(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [baseStyle, setBaseStyle] = useState<BaseMapStyle>(getStoredStyle);
  const [isMapReady, setIsMapReady] = useState(false);
  const isInitialStyleApplied = useRef(true);
  const baseStyleRef = useRef<BaseMapStyle>(baseStyle);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !token) return;
    mapboxgl.accessToken = token;
    const mapInstance = new mapboxgl.Map({
      container,
      style: MAPBOX_STYLES[baseStyle],
      center: MAP_CENTER,
      zoom: MAP_ZOOM_DEFAULT,
      logoPosition: 'bottom-right',
      attributionControl: false,
      // Отключаем телеметрию Mapbox — запросы на events.mapbox.com блокируются CORS в части окружений
      transformRequest: (url) => {
        if (!url) {
          return { url };
        }

        try {
          const parsed = new URL(url);
          if (parsed.hostname === 'events.mapbox.com') {
            // пустой JSON {} — запрос не уходит в сеть
            return { url: 'data:application/json;base64,e30=' };
          }
        } catch {
          // If URL parsing fails, fall back to the original request URL
          return { url };
        }

        return { url };
      },
    });
    mapRef.current = mapInstance;
    setMap(mapInstance);
    mapInstance.addControl(
      new mapboxgl.AttributionControl({
        customAttribution: 'velojol.kz',
      }),
      'bottom-right'
    );

    const onLoad = () => {
      setIsMapReady(true);
    };
    mapInstance.on('load', onLoad);

    return () => {
      mapInstance.off('load', onLoad);
      mapInstance.remove();
      mapRef.current = null;
      setMap(null);
      setIsMapReady(false);
    };
    // Карта создаётся один раз при монтировании; смена baseStyle — через setStyle в отдельном effect
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: init once
  }, []);

  useEffect(() => {
    if (!map) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
    };
  }, [map, containerRef]);

  const setBaseMapStyle = useCallback((style: BaseMapStyle) => {
    setBaseStyle(style);
    try {
      localStorage.setItem(STORAGE_KEY, style);
    } catch {
      // ignore quota / private mode
    }
  }, []);

  useEffect(() => {
    baseStyleRef.current = baseStyle;
  }, [baseStyle]);

  useEffect(() => {
    if (!map || !isMapReady) return;
    // Не вызываем setStyle при первой загрузке — стиль уже задан в конструкторе.
    // Иначе карта сбрасывается, срабатывает style.load до загрузки данных, точки/маршруты не появляются после hard reload.
    if (isInitialStyleApplied.current) {
      isInitialStyleApplied.current = false;
      return;
    }
    map.setStyle(MAPBOX_STYLES[baseStyle]);
  }, [baseStyle, isMapReady, map]);

  const flyTo = useCallback((center: [number, number], zoom?: number, padding?: mapboxgl.PaddingOptions) => {
    const m = mapRef.current;
    if (!m) return;
    // Padding выставляем синхронно — чтобы useMapPadding сразу видел целевое значение
    // и не запускал конкурирующий easeTo, прерывающий эту анимацию.
    if (padding) m.setPadding(padding);
    m.flyTo({ center, zoom: zoom ?? MAP_ZOOM_DEFAULT });
  }, []);

  const flyToBounds = useCallback((
    bounds: [[number, number], [number, number]],
    options?: { padding?: number | mapboxgl.PaddingOptions; maxZoom?: number }
  ) => {
    const m = mapRef.current;
    if (!m) return;
    const padding = options?.padding ?? 40;
    if (typeof padding === 'object') {
      // basePadding — чистый sidebar-padding (совпадает с тем, что выставит useMapPadding).
      // Выставляем синхронно до fitBounds: useMapPadding при ре-рендере увидит совпадение
      // и не запустит конкурирующий easeTo, который прерывал бы анимацию fitBounds.
      // Extra-отступ (разница padding − basePadding) передаём только в fitBounds как локальный —
      // он не меняет глобальный map.getPadding(), конфликта нет.
      // Выставляем весь итоговый padding (sidebar + extra) синхронно через jumpTo внутри setPadding —
      // чтобы getPadding() сразу вернул целевое значение и useMapPadding не запустил конкурирующий easeTo.
      // fitBounds вызываем без padding — он использует глобальный map.padding автоматически.
      m.setPadding(padding);
      m.fitBounds(bounds, { maxZoom: options?.maxZoom ?? 15 });
    } else {
      m.fitBounds(bounds, { padding, maxZoom: options?.maxZoom ?? 15 });
    }
  }, []);

  return {
    map,
    isMapReady,
    baseStyle,
    setBaseMapStyle,
    flyTo,
    flyToBounds,
  };
}
