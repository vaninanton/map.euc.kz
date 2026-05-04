import { useEffect, useState } from 'react'

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Доступ к геопозиции отклонён. Разрешите доступ в настройках браузера'
  }
  if (error.code === error.TIMEOUT) {
    return 'Не удалось получить геопозицию: истекло время ожидания'
  }
  return 'Не удалось определить геопозицию. Попробуйте ещё раз'
}

export function useUserGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isSupported = typeof window !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (!enabled) return
    if (!isSupported) return

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        setPosition(p)
        setError(null)
      },
      (e) => {
        setError(geolocationErrorMessage(e))
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12_000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled, isSupported])

  return { position, error, isSupported }
}
