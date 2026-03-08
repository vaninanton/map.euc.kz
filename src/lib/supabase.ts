import { createClient } from '@supabase/supabase-js';
import type { MapPointRow, MapRouteRow } from '@/types';

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const key: string | undefined = import.meta.env.VITE_SUPABASE_KEY;

const CACHE_NAME = 'map-euc-data';
const CACHE_KEY_POINTS = 'map_points';
const CACHE_KEY_ROUTES = 'map_routes';

if (!url || !key) {
  console.warn('Supabase URL or key missing. Map data will be empty.');
}

export const supabase =
  typeof url === 'string' && typeof key === 'string' ? createClient(url, key) : null;

async function getFromCache<T>(cacheKey: string): Promise<T | null> {
  if (!('caches' in self)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(`https://map.euc/cache/${cacheKey}`);
    const res = await cache.match(req);
    if (!res?.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function putInCache(cacheKey: string, data: unknown): Promise<void> {
  if (!('caches' in self)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      new Request(`https://map.euc/cache/${cacheKey}`),
      new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
    );
  } catch {
    // ignore
  }
}

export async function fetchMapPoints(): Promise<MapPointRow[]> {
  if (!supabase) return (await getFromCache<MapPointRow[]>(CACHE_KEY_POINTS)) ?? [];
  const { data, error } = await supabase
    .from('map_points')
    .select('id, type, title, description, coordinates, is_meeting');
  if (error) {
    console.error('fetchMapPoints:', error);
    const cached = await getFromCache<MapPointRow[]>(CACHE_KEY_POINTS);
    return cached ?? [];
  }
  void putInCache(CACHE_KEY_POINTS, data);
  return data as MapPointRow[];
}

export async function fetchMapRoutes(): Promise<MapRouteRow[]> {
  if (!supabase) return (await getFromCache<MapRouteRow[]>(CACHE_KEY_ROUTES)) ?? [];
  const { data, error } = await supabase
    .from('map_routes')
    .select('id, title, description, coordinates')
    .eq('flag_disabled', false);
  if (error) {
    console.error('fetchMapRoutes:', error);
    const cached = await getFromCache<MapRouteRow[]>(CACHE_KEY_ROUTES);
    return cached ?? [];
  }
  void putInCache(CACHE_KEY_ROUTES, data);
  return data as MapRouteRow[];
}
