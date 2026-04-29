import { describe, expect, it } from 'vitest';
import {
  telegramLocationsToRecentTracksFeatureCollection,
  telegramLocationsToUsersFeatureCollection,
} from '@/utils/supabaseToGeojson';
import type { TelegramLocationRow } from '@/types';

function row(partial: Partial<TelegramLocationRow>): TelegramLocationRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    created_at: partial.created_at ?? new Date().toISOString(),
    chat_id: partial.chat_id ?? 1,
    chat_title: partial.chat_title ?? 'test chat',
    telegram_user_id: partial.telegram_user_id ?? 100,
    username: partial.username ?? null,
    first_name: partial.first_name ?? null,
    last_name: partial.last_name ?? null,
    avatar_url: partial.avatar_url ?? null,
    longitude: partial.longitude ?? 76.9,
    latitude: partial.latitude ?? 43.2,
    location_accuracy_meters: partial.location_accuracy_meters ?? null,
  };
}

describe('supabaseToGeojson telegram conversion', () => {
  it('берет последнюю точку пользователя для user-фичи', () => {
    const rows = [
      row({ telegram_user_id: 7, created_at: '2026-01-01T00:00:00.000Z', longitude: 10, latitude: 10 }),
      row({ telegram_user_id: 7, created_at: '2026-01-01T00:01:00.000Z', longitude: 20, latitude: 20 }),
    ];

    const collection = telegramLocationsToUsersFeatureCollection(rows);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry.type).toBe('Point');
    expect(collection.features[0]?.geometry.coordinates).toEqual([20, 20]);
  });

  it('строит трек в исходном порядке строк', () => {
    const now = Date.now();
    const rows = [
      row({
        telegram_user_id: 11,
        created_at: new Date(now - 3 * 60 * 1000).toISOString(),
        longitude: 1,
        latitude: 1,
      }),
      row({
        telegram_user_id: 11,
        created_at: new Date(now - 2 * 60 * 1000).toISOString(),
        longitude: 2,
        latitude: 2,
      }),
      row({
        telegram_user_id: 11,
        created_at: new Date(now - 1 * 60 * 1000).toISOString(),
        longitude: 3,
        latitude: 3,
      }),
    ];

    const collection = telegramLocationsToRecentTracksFeatureCollection(rows);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry.type).toBe('LineString');
    expect(collection.features[0]?.geometry.coordinates).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it('считает среднюю скорость для telegramUser', () => {
    const rows = [
      row({ telegram_user_id: 42, created_at: '2026-01-01T00:00:00.000Z', longitude: 76.90, latitude: 43.20 }),
      row({ telegram_user_id: 42, created_at: '2026-01-01T00:05:00.000Z', longitude: 76.91, latitude: 43.20 }),
      row({ telegram_user_id: 42, created_at: '2026-01-01T00:10:00.000Z', longitude: 76.92, latitude: 43.20 }),
    ];

    const users = telegramLocationsToUsersFeatureCollection(rows);
    const userFeature = users.features[0];
    expect(userFeature).toBeDefined();
    expect(userFeature?.properties.type).toBe('telegramUser');
    if (!userFeature || userFeature.properties.type !== 'telegramUser') {
      throw new Error('Ожидали telegramUser фичу');
    }
    expect(typeof userFeature.properties.avgSpeedKmh).toBe('number');
    expect((userFeature.properties.avgSpeedKmh ?? 0) > 0).toBe(true);
  });
});
