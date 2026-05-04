/**
 * iOS 13+: запрос разрешения на ориентацию/компас. Должен вызываться в обработчике жеста пользователя.
 */
export async function requestDeviceOrientationPermissionIfNeeded(): Promise<void> {
  if (typeof DeviceOrientationEvent === 'undefined') {
    return
  }
  const withPermission = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<PermissionState>
  }
  if (typeof withPermission.requestPermission !== 'function') {
    return
  }
  try {
    await withPermission.requestPermission()
  } catch {
    // игнорируем — радар всё равно откроется, компас может быть недоступен
  }
}
