const CACHE_VERSION = 'map-euc-v6';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];
const HOME_FALLBACK = '/';

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

async function cleanupOutdatedCaches(activeCaches) {
  const keys = await caches.keys();
  const staleKeys = keys.filter((key) => !activeCaches.has(key));
  await Promise.all(staleKeys.map((key) => caches.delete(key)));
}

async function handleNavigationRequest(request) {
  console.log('navigate', request.url);
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_VERSION);
    return (await cache.match(HOME_FALLBACK)) || Response.error();
  }
}

async function handleAppAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  const requestUrl = new URL(request.url);
  if (response.ok && isHttpRequest(requestUrl) && isSameOrigin(requestUrl)) {
    console.log('fromcache', request.url);
    await addToCache(CACHE_VERSION, request, response);
  }
  return response;
}

async function handleInstall() {
  console.log('install service worker', CACHE_VERSION);
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(APP_SHELL);
  await self.skipWaiting();
}

async function handleActivate() {
  await cleanupOutdatedCaches(new Set([CACHE_VERSION]));
  await self.clients.claim();
}

console.log('service worker loaded');

self.addEventListener('install', (event) => {
  event.waitUntil(handleInstall());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(handleActivate());
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
