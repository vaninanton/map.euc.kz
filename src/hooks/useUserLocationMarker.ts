import { useCallback, useEffect, useRef, useState } from 'react';
import { Marker } from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';

function createUserMarkerElement() {
  const markerEl = document.createElement('div');
  markerEl.style.width = '28px';
  markerEl.style.height = '28px';
  markerEl.style.borderRadius = '999px';
  markerEl.style.background = '#2563eb';
  markerEl.style.border = '3px solid #ffffff';
  markerEl.style.boxShadow = '0 3px 12px rgba(0,0,0,0.28)';
  markerEl.style.position = 'relative';
  markerEl.setAttribute('aria-label', 'Моя геопозиция');

  const directionEl = document.createElement('div');
  directionEl.dataset.role = 'user-direction';
  directionEl.style.position = 'absolute';
  directionEl.style.left = '50%';
  directionEl.style.top = '-9px';
  directionEl.style.width = '0';
  directionEl.style.height = '0';
  directionEl.style.borderLeft = '5px solid transparent';
  directionEl.style.borderRight = '5px solid transparent';
  directionEl.style.borderBottom = '10px solid #1d4ed8';
  directionEl.style.transform = 'translateX(-50%)';
  directionEl.style.transformOrigin = '50% 21px';
  directionEl.style.display = 'none';

  markerEl.appendChild(directionEl);
  return markerEl;
}

export function useUserLocationMarker(map: MapboxMap | null) {
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);
  const userLocationMarkerRef = useRef<Marker | null>(null);
  const compassHeadingRef = useRef<number | null>(null);
  const isCompassListeningRef = useRef(false);

  const updateDirectionArrow = useCallback((heading: number | null) => {
    const markerElement = userLocationMarkerRef.current?.getElement();
    const directionElement = markerElement?.querySelector<HTMLElement>('[data-role="user-direction"]');
    if (!directionElement) return;

    directionElement.style.display = 'block';
    if (typeof heading === 'number' && Number.isFinite(heading) && heading >= 0) {
      directionElement.style.transform = `translateX(-50%) rotate(${heading}deg)`;
      directionElement.style.opacity = '1';
      return;
    }

    directionElement.style.transform = 'translateX(-50%) rotate(0deg)';
    directionElement.style.opacity = '0.75';
  }, []);

  const handleDeviceOrientation = useCallback((event: DeviceOrientationEvent) => {
    const eventWithCompass = event as DeviceOrientationEvent & { webkitCompassHeading?: number };

    let heading: number | null = null;
    if (typeof eventWithCompass.webkitCompassHeading === 'number' && Number.isFinite(eventWithCompass.webkitCompassHeading)) {
      heading = eventWithCompass.webkitCompassHeading;
    } else if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
      heading = (360 - event.alpha + 360) % 360;
    }

    if (typeof heading === 'number' && Number.isFinite(heading)) {
      compassHeadingRef.current = heading;
      updateDirectionArrow(heading);
    }
  }, [updateDirectionArrow]);

  const ensureCompassListener = useCallback(async () => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window) || isCompassListeningRef.current) {
      return;
    }

    const DeviceOrientationCtor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceOrientationCtor.requestPermission === 'function') {
      try {
        const permissionState = await DeviceOrientationCtor.requestPermission();
        if (permissionState !== 'granted') return;
      } catch {
        return;
      }
    }

    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    isCompassListeningRef.current = true;
  }, [handleDeviceOrientation]);

  const locateUser = useCallback(() => {
    if (!map || isLocatingUser) return;
    if (!('geolocation' in navigator)) {
      setLocationErrorMessage('Геолокация не поддерживается в этом браузере')
      return;
    }

    setIsLocatingUser(true);
    setLocationErrorMessage(null);
    void ensureCompassListener();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        const headingFromCoords = position.coords.heading;
        const heading =
          typeof headingFromCoords === 'number' && Number.isFinite(headingFromCoords) && headingFromCoords >= 0
            ? headingFromCoords
            : compassHeadingRef.current;

        if (!userLocationMarkerRef.current) {
          userLocationMarkerRef.current = new Marker({
            element: createUserMarkerElement(),
            anchor: 'center',
          })
            .setLngLat([lng, lat])
            .addTo(map);
        } else {
          userLocationMarkerRef.current.setLngLat([lng, lat]);
        }

        updateDirectionArrow(heading);

        map.flyTo({ center: [lng, lat], zoom: 15.5, essential: true });
        setIsLocatingUser(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationErrorMessage('Доступ к геопозиции отклонён. Разрешите доступ в настройках браузера')
        } else if (error.code === error.TIMEOUT) {
          setLocationErrorMessage('Не удалось получить геопозицию: истекло время ожидания')
        } else {
          setLocationErrorMessage('Не удалось определить геопозицию. Попробуйте ещё раз')
        }
        setIsLocatingUser(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30_000,
      }
    );
  }, [ensureCompassListener, map, isLocatingUser, updateDirectionArrow]);

  useEffect(() => {
    return () => {
      if (isCompassListeningRef.current) {
        window.removeEventListener('deviceorientation', handleDeviceOrientation);
      }
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
    };
  }, [handleDeviceOrientation]);

  return { isLocatingUser, locateUser, locationErrorMessage, clearLocationError: () => setLocationErrorMessage(null) };
}
