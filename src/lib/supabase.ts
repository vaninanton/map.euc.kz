import { createClient } from '@supabase/supabase-js';
import type {
  MapPointDraftInput,
  MapPointRow,
  MapRouteRow,
  MapPointPhotoRow,
  TelegramLocationRow,
  TelegramProfileRow,
} from '@/types';
import { isRecord } from '@/utils/mapFeatureGuards';

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const key: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_TELEGRAM_GEO_TTL_MINUTES = 60;
const DEFAULT_TELEGRAM_MAX_ACCURACY_METERS = 100;

if (!url || !key) {
  console.warn('Supabase URL or key missing. Map data will be empty.');
}

export const supabase =
  typeof url === 'string' && typeof key === 'string' ? createClient(url, key) : null;

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getTelegramGeoTtlMinutes(): number {
  return parsePositiveInt(import.meta.env.VITE_TELEGRAM_GEO_TTL_MINUTES, DEFAULT_TELEGRAM_GEO_TTL_MINUTES);
}

function getTelegramMaxAccuracyMeters(): number {
  return parsePositiveInt(import.meta.env.VITE_TELEGRAM_MAX_ACCURACY_METERS, DEFAULT_TELEGRAM_MAX_ACCURACY_METERS);
}

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
  const isMeeting = row.flag_is_meeting;
  const hasSocket = row.flag_has_socket;
  const photos = normalizeMapPointPhotos(row.map_point_photos);
  if ((typeof id !== 'string' && typeof id !== 'number') || (type !== 'point' && type !== 'socket') || typeof title !== 'string' || !coordinates) {
    return null;
  }
  return {
    id: String(id),
    type,
    title,
    description: typeof description === 'string' ? description : null,
    coordinates,
    flag_is_meeting: typeof isMeeting === 'boolean' ? isMeeting : null,
    flag_has_socket: typeof hasSocket === 'boolean' ? hasSocket : null,
    photos,
  };
}

function normalizeMapPointPhotos(value: unknown): MapPointPhotoRow[] {
  if (!Array.isArray(value)) return [];
  const items: MapPointPhotoRow[] = [];

  for (const row of value) {
    if (!isRecord(row)) continue;
    const id = row.id;
    const bucketName = row.bucket_name;
    const storagePath = row.storage_path;
    const altText = row.alt_text;
    const sortOrder = row.sort_order;

    if (
      (typeof id !== 'string' && typeof id !== 'number') ||
      typeof bucketName !== 'string' ||
      typeof storagePath !== 'string'
    ) {
      continue;
    }

    const fallbackPublicUrl =
      typeof url === 'string'
        ? `${url}/storage/v1/object/public/${encodeURIComponent(bucketName)}/${storagePath
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/')}`
        : '';
    const publicUrl = supabase
      ? supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl
      : fallbackPublicUrl;

    items.push({
      id: String(id),
      bucket_name: bucketName,
      storage_path: storagePath,
      alt_text: typeof altText === 'string' ? altText : null,
      sort_order: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : 0,
      public_url: publicUrl,
    });
  }

  items.sort((a, b) => a.sort_order - b.sort_order);
  return items;
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

function normalizeTelegramLocationRow(row: unknown): TelegramLocationRow | null {
  if (!isRecord(row)) return null;
  const id = row.id;
  const createdAt = row.created_at;
  const chatId = row.chat_id;
  const chatTitle = row.chat_title;
  const telegramUserId = row.telegram_user_id;
  const username = row.username;
  const firstName = row.first_name;
  const lastName = row.last_name;
  const avatarUrl = row.avatar_url;
  const longitude = row.longitude;
  const latitude = row.latitude;
  const locationAccuracyMeters = row.location_accuracy_meters;

  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof createdAt !== 'string' ||
    typeof chatId !== 'number' ||
    typeof telegramUserId !== 'number' ||
    typeof longitude !== 'number' ||
    typeof latitude !== 'number'
  ) {
    return null;
  }

  return {
    id: String(id),
    created_at: createdAt,
    chat_id: chatId,
    chat_title: typeof chatTitle === 'string' ? chatTitle : null,
    telegram_user_id: telegramUserId,
    username: typeof username === 'string' ? username : null,
    first_name: typeof firstName === 'string' ? firstName : null,
    last_name: typeof lastName === 'string' ? lastName : null,
    avatar_url: typeof avatarUrl === 'string' ? avatarUrl : null,
    longitude,
    latitude,
    location_accuracy_meters:
      typeof locationAccuracyMeters === 'number' && Number.isFinite(locationAccuracyMeters)
        ? locationAccuracyMeters
        : null,
  };
}

function normalizeTelegramProfileRow(row: unknown): TelegramProfileRow | null {
  if (!isRecord(row)) return null;
  const telegramUserId = row.telegram_user_id;
  const username = row.username;
  const firstName = row.first_name;
  const lastName = row.last_name;
  const avatarUrl = row.avatar_url;
  const updatedAt = row.updated_at;

  if (typeof telegramUserId !== 'number' || typeof updatedAt !== 'string') {
    return null;
  }

  return {
    telegram_user_id: telegramUserId,
    username: typeof username === 'string' ? username : null,
    first_name: typeof firstName === 'string' ? firstName : null,
    last_name: typeof lastName === 'string' ? lastName : null,
    avatar_url: typeof avatarUrl === 'string' ? avatarUrl : null,
    updated_at: updatedAt,
  };
}

export async function fetchMapPoints(): Promise<MapPointRow[]> {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  const { data, error } = await supabase
    .from('map_points')
    .select('id, type, title, description, coordinates, flag_is_meeting, flag_has_socket, map_point_photos(id, bucket_name, storage_path, alt_text, sort_order)')
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
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.');
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

export async function fetchTelegramLocations(): Promise<TelegramLocationRow[]> {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  const pageSize = 1000;
  const ttlMinutes = getTelegramGeoTtlMinutes();
  const maxAccuracyMeters = getTelegramMaxAccuracyMeters();
  const ttlThresholdIso = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();
  const locationRowsRaw: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('telegram_locations')
      .select(
        'id, created_at, chat_id, chat_title, telegram_user_id, username, first_name, last_name, longitude, latitude, location_accuracy_meters'
      )
      .gte('created_at', ttlThresholdIso)
      .or(`location_accuracy_meters.is.null,location_accuracy_meters.lte.${String(maxAccuracyMeters)}`)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('fetchTelegramLocations:', error);
      throw new Error('Не удалось загрузить telegram-локации.');
    }

    const batch = data ?? [];
    locationRowsRaw.push(...batch);
    if (batch.length < pageSize) break;
  }

  const profileRowsRaw: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data: profilesData, error: profilesError } = await supabase
      .from('telegram_profiles')
      .select('telegram_user_id, username, first_name, last_name, avatar_url, updated_at')
      .order('telegram_user_id', { ascending: true })
      .range(from, to);

    if (profilesError) {
      console.error('fetchTelegramLocations: profiles', profilesError);
      throw new Error('Не удалось загрузить профили Telegram.');
    }

    const batch = profilesData ?? [];
    profileRowsRaw.push(...batch);
    if (batch.length < pageSize) break;
  }

  const profilesByUserId = new Map<number, TelegramProfileRow>();
  for (const row of profileRowsRaw) {
    const normalized = normalizeTelegramProfileRow(row);
    if (normalized) profilesByUserId.set(normalized.telegram_user_id, normalized);
  }

  const rows: TelegramLocationRow[] = [];
  for (const row of locationRowsRaw) {
    const normalized = normalizeTelegramLocationRow(row);
    if (!normalized) continue;
    const profile = profilesByUserId.get(normalized.telegram_user_id);
    rows.push({
      ...normalized,
      username: profile?.username ?? normalized.username,
      first_name: profile?.first_name ?? normalized.first_name,
      last_name: profile?.last_name ?? normalized.last_name,
      avatar_url: profile?.avatar_url ?? normalized.avatar_url,
    });
  }
  return rows;
}

export async function createMapPointDraft(input: MapPointDraftInput): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  const { error } = await supabase.from('map_points_submissions').insert({
    type: input.type,
    title: input.title,
    description: input.description,
    coordinates: input.coordinates,
    flag_is_meeting: input.type === 'point' ? Boolean(input.flag_is_meeting) : false,
  });

  if (error) {
    console.error('createMapPointDraft:', error);
    throw new Error('Не удалось отправить заявку. Проверьте RLS/policy для таблицы заявок.');
  }
}
