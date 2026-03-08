/**
 * Отдаётся по /sw.js — тот же URL, что у старого PWA (vite-plugin-pwa).
 * Браузер при проверке обновлений SW запрашивает этот URL (без кеша), получает наш скрипт,
 * устанавливает как «новую версию» и активирует → очистка кешей и снятие регистрации.
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
