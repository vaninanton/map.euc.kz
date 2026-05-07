import { useEffect, useState, useCallback } from 'react'

function readHeading(event: DeviceOrientationEvent): number | null {
  const iosHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: unknown }).webkitCompassHeading
  if (typeof iosHeading === 'number' && Number.isFinite(iosHeading)) {
    return iosHeading
  }
  if (event.absolute && event.alpha != null && Number.isFinite(event.alpha)) {
    return (360 - event.alpha + 360) % 360
  }
  return null
}

interface CompassHeadingResult {
  heading: number | null
  compassEnabled: boolean
  toggleCompass: () => void
}

/**
 * Курс устройства в градусах (0 — север, по часовой).
 * На iOS требует разрешения — запрашивается лениво при включении переключателя.
 */
export function useDeviceCompassHeading(radarOpen: boolean): CompassHeadingResult {
  const [heading, setHeading] = useState<number | null>(null)
  const [compassEnabled, setCompassEnabled] = useState(false)

  const toggleCompass = useCallback(async () => {
    if (compassEnabled) {
      setCompassEnabled(false)
      setHeading(null)
      return
    }

    if (typeof DeviceOrientationEvent !== 'undefined') {
      const withPermission = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<PermissionState>
      }
      if (typeof withPermission.requestPermission === 'function') {
        try {
          const result = await withPermission.requestPermission()
          if (result !== 'granted') return
        } catch {
          return
        }
      }
    }

    setCompassEnabled(true)
  }, [compassEnabled])

  useEffect(() => {
    if (!compassEnabled || !radarOpen || typeof window === 'undefined') return

    const handler = (e: DeviceOrientationEvent) => {
      const h = readHeading(e)
      if (h != null) setHeading(h)
    }

    window.addEventListener('deviceorientation', handler, true)
    return () => {
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [compassEnabled, radarOpen])

  useEffect(() => {
    if (!radarOpen) {
      setCompassEnabled(false)
      setHeading(null)
    }
  }, [radarOpen])

  return { heading, compassEnabled, toggleCompass }
}
