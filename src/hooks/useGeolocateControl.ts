import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';

const GEOLOCATE_TIMEOUT_MS = 15000;

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Доступ к геопозиции отклонён. Разрешите доступ в настройках браузера';
  }
  if (error.code === error.TIMEOUT) {
    return 'Не удалось получить геопозицию: истекло время ожидания';
  }
  return 'Не удалось определить геопозицию. Попробуйте ещё раз';
}

/**
 * Встроенный {@link mapboxgl.GeolocateControl}: трекинг позиции, точка и направление (компас/GPS),
 * как в официальном примере Mapbox. Стандартная кнопка скрыта — вызывается {@link mapboxgl.GeolocateControl.trigger} с нашей кнопки.
 */
export function useGeolocateControl(map: MapboxMap | null, isMapReady: boolean) {
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);
  const locateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLocateTimeout = useCallback(() => {
    if (locateTimeoutRef.current !== null) {
      clearTimeout(locateTimeoutRef.current);
      locateTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!map || !isMapReady) {
      geolocateRef.current = null;
      return;
    }

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
      showButton: false,
    });

    const onGeolocate = () => {
      clearLocateTimeout();
      setIsLocatingUser(false);
      setLocationErrorMessage(null);
    };

    const onError = (e: GeolocationPositionError) => {
      clearLocateTimeout();
      setIsLocatingUser(false);
      setLocationErrorMessage(geolocationErrorMessage(e));
    };

    const onOutOfMaxBounds = () => {
      clearLocateTimeout();
      setIsLocatingUser(false);
      setLocationErrorMessage('Геопозиция за пределами области карты');
    };

    geolocate.on('geolocate', onGeolocate);
    geolocate.on('error', onError);
    geolocate.on('outofmaxbounds', onOutOfMaxBounds);

    map.addControl(geolocate);
    geolocateRef.current = geolocate;

    return () => {
      geolocate.off('geolocate', onGeolocate);
      geolocate.off('error', onError);
      geolocate.off('outofmaxbounds', onOutOfMaxBounds);
      clearLocateTimeout();
      map.removeControl(geolocate);
      geolocateRef.current = null;
    };
  }, [map, isMapReady, clearLocateTimeout]);

  const locateUser = useCallback(() => {
    if (!map || isLocatingUser) return;

    const geolocate = geolocateRef.current;
    if (!geolocate) {
      setLocationErrorMessage('Карта ещё загружается, подождите секунду');
      return;
    }

    setLocationErrorMessage(null);
    setIsLocatingUser(true);
    clearLocateTimeout();
    locateTimeoutRef.current = setTimeout(() => {
      locateTimeoutRef.current = null;
      setIsLocatingUser(false);
    }, GEOLOCATE_TIMEOUT_MS);

    const triggered = geolocate.trigger();
    if (!triggered) {
      clearLocateTimeout();
      setIsLocatingUser(false);
      setLocationErrorMessage('Геолокация не поддерживается в этом браузере');
    }
  }, [map, isLocatingUser, clearLocateTimeout]);

  return {
    isLocatingUser,
    locateUser,
    locationErrorMessage,
    clearLocationError: () => {
      setLocationErrorMessage(null);
    },
  };
}
