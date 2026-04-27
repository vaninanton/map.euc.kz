import { createClient } from '@supabase/supabase-js';
import type { MapPointDraftInput, MapPointRow, MapRouteRow } from '@/types';
import { isRecord } from '@/utils/mapFeatureGuards';

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const key: string | undefined = import.meta.env.VITE_SUPABASE_KEY;
const pointSubmissionsTable: string = import.meta.env.VITE_SUPABASE_POINT_SUBMISSIONS_TABLE ?? 'map_points_submissions';

if (!url || !key) {
  console.warn('Supabase URL or key missing. Map data will be empty.');
}

export const supabase =
  typeof url === 'string' && typeof key === 'string' ? createClient(url, key) : null;

function asPointCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [lon, lat] = value;
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  return [lon, lat];
}

function asLineCoordinates(value: unknown): Array<[number, number] | [number, number, number]> | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const points: Array<[number, number] | [number, number, number]> = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const [lon, lat, elevation] = item;
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;
    if (elevation !== undefined && typeof elevation !== 'number') return null;
    points.push(
      elevation === undefined ? [lon, lat] : [lon, lat, elevation]
    );
  }
  return points;
}

function normalizeMapPointRow(row: unknown): MapPointRow | null {
  if (!isRecord(row)) return null;
  const id = row.id;
  const type = row.type;
  const title = row.title;
  const description = row.description;
  const coordinates = asPointCoordinates(row.coordinates);
  const isMeeting = row.is_meeting;
  if ((typeof id !== 'string' && typeof id !== 'number') || (type !== 'point' && type !== 'socket') || typeof title !== 'string' || !coordinates) {
    return null;
  }
  return {
    id: String(id),
    type,
    title,
    description: typeof description === 'string' ? description : null,
    coordinates,
    is_meeting: typeof isMeeting === 'boolean' ? isMeeting : null,
  };
}

function normalizeMapRouteRow(row: unknown): MapRouteRow | null {
  if (!isRecord(row)) return null;
  const id = row.id;
  const title = row.title;
  const description = row.description;
  const coordinates = asLineCoordinates(row.coordinates);
  if ((typeof id !== 'string' && typeof id !== 'number') || typeof title !== 'string' || !coordinates) {
    return null;
  }
  return {
    id: String(id),
    title,
    description: typeof description === 'string' ? description : null,
    coordinates,
  };
}

export async function fetchMapPoints(): Promise<MapPointRow[]> {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_KEY.');
  }

  const { data, error } = await supabase
    .from('map_points')
    .select('id, type, title, description, coordinates, is_meeting')
    .eq('flag_disabled', false);

  if (error) {
    console.error('fetchMapPoints:', error);
    throw new Error('Не удалось загрузить точки');
  }

  const rows: MapPointRow[] = [];
  for (const row of data ?? []) {
    const normalized = normalizeMapPointRow(row);
    if (normalized) rows.push(normalized);
  }
  return rows;
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

  const rows: MapRouteRow[] = [];
  for (const row of data ?? []) {
    const normalized = normalizeMapRouteRow(row);
    if (normalized) rows.push(normalized);
  }
  return rows;
}

export async function createMapPointDraft(input: MapPointDraftInput): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_KEY.');
  }

  const { error } = await supabase.from('map_points_submissions').insert({
    type: input.type,
    title: input.title,
    description: input.description,
    coordinates: input.coordinates,
    is_meeting: input.type === 'point' ? Boolean(input.is_meeting) : false,
  });

  if (error) {
    console.error('createMapPointDraft:', error);
    throw new Error('Не удалось отправить заявку. Проверьте RLS/policy для таблицы заявок.');
  }
}
