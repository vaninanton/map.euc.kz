import type { Feature, FeatureCollection, PointFeature, RouteFeature } from '@/types/geojson';
import type { MapPointRow, MapRouteRow, TelegramLocationRow } from '@/types/supabase';

const DEFAULT_TELEGRAM_GEO_TTL_MINUTES = 60;
const DEFAULT_TELEGRAM_TRACK_TAIL_MINUTES = 30;

function parseEnvPositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getTelegramGeoTtlMinutes(): number {
  return parseEnvPositiveInt(import.meta.env.VITE_TELEGRAM_GEO_TTL_MINUTES, DEFAULT_TELEGRAM_GEO_TTL_MINUTES);
}

function getTelegramTrackTailMinutes(): number {
  return parseEnvPositiveInt(import.meta.env.VITE_TELEGRAM_TRACK_TAIL_MINUTES, DEFAULT_TELEGRAM_TRACK_TAIL_MINUTES);
}

function isPointCoordinates(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

function isLineCoordinates(value: unknown): value is Array<[number, number] | [number, number, number]> {
  if (!Array.isArray(value) || value.length < 2) return false;
  return value.every(
    (item) =>
      Array.isArray(item) &&
      item.length >= 2 &&
      typeof item[0] === 'number' &&
      typeof item[1] === 'number' &&
      (item[2] === undefined || typeof item[2] === 'number')
  );
}

export function mapPointsToFeatureCollection(
  rows: MapPointRow[]
): FeatureCollection<{ type: 'Point'; coordinates: [number, number] }> {
  const features: PointFeature[] = rows
    .filter((row) => isPointCoordinates(row.coordinates))
    .map((row) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: row.coordinates,
    },
    properties: {
      id: row.id,
      name: row.title,
      description: row.description ?? undefined,
      type: row.type,
      ...(row.photos.length > 0 && {
        photos: row.photos.map((photo) => ({
          id: photo.id,
          url: photo.public_url,
          alt: photo.alt_text,
          sortOrder: photo.sort_order,
        })),
      }),
      ...(row.flag_is_meeting === true && { isMeeting: true }),
      ...(row.flag_has_socket === true && { hasSocket: true }),
    },
  }));
  return { type: 'FeatureCollection', features };
}

export function mapRoutesToFeatureCollection(rows: MapRouteRow[]): FeatureCollection {
  const features: RouteFeature[] = rows
    .filter((row) => isLineCoordinates(row.coordinates))
    .map((row) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: row.coordinates,
    },
    properties: {
      id: row.id,
      name: row.title,
      description: row.description ?? undefined,
      type: 'route',
    },
  }));
  return { type: 'FeatureCollection', features };
}

function buildTelegramDisplayName(row: TelegramLocationRow): string {
  if (row.username) return `@${row.username}`;
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  if (fullName.length > 0) return fullName;
  return `Пользователь ${String(row.telegram_user_id)}`;
}

function buildTelegramAvatarUrl(row: TelegramLocationRow): string {
  if (row.avatar_url) return row.avatar_url;
  const seed = row.username ?? `${row.telegram_user_id}`;
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export function telegramLocationsToUsersFeatureCollection(rows: TelegramLocationRow[]): FeatureCollection {
  if (rows.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  const pointsTtlMs = getTelegramGeoTtlMinutes() * 60 * 1000;
  const nowTs = Date.now();
  const latestByUser = new Map<number, TelegramLocationRow>();
  for (const row of rows) {
    const existing = latestByUser.get(row.telegram_user_id);
    if (!existing || existing.created_at < row.created_at) {
      latestByUser.set(row.telegram_user_id, row);
    }
  }

  const features: PointFeature[] = Array.from(latestByUser.values())
    .filter((row) => {
      const ts = Date.parse(row.created_at);
      return Number.isFinite(ts) && nowTs - ts <= pointsTtlMs;
    })
    .map((row) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [row.longitude, row.latitude],
      },
      properties: {
        id: `telegram-user-${String(row.telegram_user_id)}`,
        name: buildTelegramDisplayName(row),
        description: row.chat_title
          ? `Чат: ${row.chat_title}`
          : `Чат ID: ${String(row.chat_id)}`,
        type: 'telegramUser',
        telegramUserId: row.telegram_user_id,
        username: row.username,
        firstName: row.first_name,
        lastName: row.last_name,
        updatedAt: row.created_at,
        ageMinutes: Math.max(0, (nowTs - Date.parse(row.created_at)) / 60000),
        avatarUrl: buildTelegramAvatarUrl(row),
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function telegramLocationsToRecentTracksFeatureCollection(rows: TelegramLocationRow[]): FeatureCollection {
  if (rows.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  const trackTailMinutes = getTelegramTrackTailMinutes();
  const tailThresholdTs = Date.now() - trackTailMinutes * 60 * 1000;
  const byUser = new Map<number, TelegramLocationRow[]>();

  for (const row of rows) {
    const timestamp = Date.parse(row.created_at);
    if (!Number.isFinite(timestamp) || timestamp < tailThresholdTs) {
      continue;
    }
    const bucket = byUser.get(row.telegram_user_id);
    if (bucket) {
      bucket.push(row);
    } else {
      byUser.set(row.telegram_user_id, [row]);
    }
  }

  const features: Feature[] = [];
  for (const [telegramUserId, userRows] of byUser) {
    const sorted = [...userRows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sorted.length < 2) continue;

    const lastPoint = sorted[sorted.length - 1];
    const displayName = buildTelegramDisplayName(lastPoint);
    const avatarUrl = buildTelegramAvatarUrl(lastPoint);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: sorted.map((point) => [point.longitude, point.latitude] as [number, number]),
      },
      properties: {
        id: `telegram-track-${String(telegramUserId)}`,
        name: `Трек ${displayName}`,
        description: `Маршрут за последние ${String(trackTailMinutes)} минут (${String(sorted.length)} точек).`,
        type: 'telegramUser',
        telegramUserId,
        username: lastPoint.username,
        firstName: lastPoint.first_name,
        lastName: lastPoint.last_name,
        updatedAt: lastPoint.created_at,
        avatarUrl,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
