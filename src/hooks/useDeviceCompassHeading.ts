import { useEffect, useState } from 'react'

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

/**
 * Курс устройства в градусах (0 — север, по часовой), если доступен {@link DeviceOrientationEvent}.
 * На десктопе обычно `null` — радар остаётся с севером вверх.
 */
export function useDeviceCompassHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const handler = (e: DeviceOrientationEvent) => {
      const h = readHeading(e)
      if (h != null) {
        setHeading(h)
      }
    }

    window.addEventListener('deviceorientation', handler, true)
    return () => {
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [enabled])

  return heading
}
