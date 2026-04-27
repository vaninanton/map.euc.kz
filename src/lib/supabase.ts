import { createClient } from '@supabase/supabase-js';
import type { MapPointRow, MapRouteRow } from '@/types';

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const key: string | undefined = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  console.warn('Supabase URL or key missing. Map data will be empty.');
}

export const supabase =
  typeof url === 'string' && typeof key === 'string' ? createClient(url, key) : null;

export async function fetchMapPoints(): Promise<MapPointRow[]> {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_KEY.');
  }

  const { data, error } = await supabase
    .from('map_points')
    .select('id, type, title, description, coordinates, is_meeting');

  if (error) {
    console.error('fetchMapPoints:', error);
    throw new Error('Не удалось загрузить точки');
  }

  return data as MapPointRow[];
}

export async function fetchMapRoutes(): Promise<MapRouteRow[]> {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_KEY.');
  }

  const { data, error } = await supabase
    .from('map_routes')
    .select('id, title, description, coordinates')
    .eq('flag_disabled', false);

  if (error) {
    console.error('fetchMapRoutes:', error);
    throw new Error('Не удалось загрузить маршруты');
  }

  return data as MapRouteRow[];
}
