import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Map as MapboxMap } from 'mapbox-gl'
import { trackGoal } from '@/lib/analytics'

function geolocationErrorMessage(error: GeolocationPositionError): string {
    if (error.code === error.PERMISSION_DENIED) {
        return 'Доступ к геопозиции отклонён. Разрешите доступ в настройках браузера'
    }
    if (error.code === error.TIMEOUT) {
        return 'Не удалось получить геопозицию: истекло время ожидания'
    }
    return 'Не удалось определить геопозицию. Попробуйте ещё раз'
}

/**
 * Встроенный {@link mapboxgl.GeolocateControl}: трекинг позиции, точка и направление (компас/GPS),
 * как в официальном примере Mapbox.
 */
export function useGeolocateControl(map: MapboxMap | null, isMapReady: boolean) {
    const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null)
    // Цель geolocation_success шлём один раз за сессию: при трекинге событие geolocate
    // приходит на каждое обновление позиции, нам же важен сам факт успешной геолокации.
    const geolocateGoalSentRef = useRef(false)

    useEffect(() => {
        if (!map || !isMapReady) {
            return
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
            showButton: true,
        })

        const onGeolocate = () => {
            setLocationErrorMessage(null)
            if (!geolocateGoalSentRef.current) {
                geolocateGoalSentRef.current = true
                trackGoal('geolocation_success')
            }
        }

        const onError = (e: GeolocationPositionError) => {
            setLocationErrorMessage(geolocationErrorMessage(e))
            if (e.code === e.PERMISSION_DENIED) {
                trackGoal('geolocation_denied')
            }
        }

        const onOutOfMaxBounds = () => {
            setLocationErrorMessage('Геопозиция за пределами области карты')
        }

        geolocate.on('geolocate', onGeolocate)
        geolocate.on('error', onError)
        geolocate.on('outofmaxbounds', onOutOfMaxBounds)

        map.addControl(geolocate, 'right')

        return () => {
            geolocate.off('geolocate', onGeolocate)
            geolocate.off('error', onError)
            geolocate.off('outofmaxbounds', onOutOfMaxBounds)
            map.removeControl(geolocate)
        }
    }, [map, isMapReady])

    return {
        locationErrorMessage,
        clearLocationError: () => {
            setLocationErrorMessage(null)
        },
    }
}
