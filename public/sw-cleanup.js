/**
 * Одноразовый сервис-воркер: очищает все кеши и снимает регистрацию (в т.ч. старого PWA).
 * Регистрируется только при наличии уже зарегистрированных SW, затем удаляет себя.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
    })()
  );
});
