const SW_URL = new URL(self.location.href);
const APP_VERSION = SW_URL.searchParams.get('v') || 'dev';
const CACHE_VERSION = `map-euc-${APP_VERSION}`;
const BASE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}favicon.svg`,
];
const HOME_FALLBACK = `${BASE_PATH}`;
const STATIC_ASSET_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const MAX_RUNTIME_ENTRIES = 120;

function isHttpRequest(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function addToCache(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

function isStaticAssetRequest(requestUrl) {
  if (!isSameOrigin(requestUrl)) return false;
  if (!requestUrl.pathname.startsWith(BASE_PATH)) return false;
  const relativePath = requestUrl.pathname.slice(BASE_PATH.length);
  return (
    relativePath.startsWith('assets/') ||
    relativePath.startsWith('icons/') ||
    relativePath.endsWith('.css') ||
    relativePath.endsWith('.js') ||
    relativePath.endsWith('.svg') ||
    relativePath.endsWith('.png') ||
    relativePath.endsWith('.webmanifest')
  );
}

async function trimRuntimeCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const stale = keys.slice(0, keys.length - maxEntries);
  await Promise.all(stale.map((request) => cache.delete(request)));
}

async function cleanupOutdatedCaches(activeCaches) {
  const keys = await caches.keys();
  const staleKeys = keys.filter((key) => !activeCaches.has(key));
  await Promise.all(staleKeys.map((key) => caches.delete(key)));
}

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await addToCache(RUNTIME_CACHE, request, response);
      await trimRuntimeCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch {
    const cache = await caches.open(RUNTIME_CACHE);
    return (await cache.match(request)) || (await cache.match(HOME_FALLBACK)) || Response.error();
  }
}

async function handleAppAssetRequest(request) {
  const requestUrl = new URL(request.url);
  if (!isStaticAssetRequest(requestUrl)) return fetch(request);

  const cache = await caches.open(STATIC_ASSET_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok && isHttpRequest(requestUrl) && isSameOrigin(requestUrl)) {
    await addToCache(STATIC_ASSET_CACHE, request, response);
  }
  return response;
}

async function handleInstall() {
  const cache = await caches.open(STATIC_ASSET_CACHE);
  await cache.addAll(APP_SHELL);
}

async function handleActivate() {
  await cleanupOutdatedCaches(new Set([STATIC_ASSET_CACHE, RUNTIME_CACHE]));
  await self.clients.claim();
}

self.addEventListener('install', (event) => {
  event.waitUntil(handleInstall());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(handleActivate());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAppAssetRequest(request));
});
