import type { LayerKey } from '@/constants';
import type { FeatureType } from '@/types/geojson';

/** Тип элемента в hash совпадает с FeatureType. */
export type HashFeatureType = FeatureType;

/** Нормализация типа из hash (после toLowerCase) в HashFeatureType. */
const NORMALIZED_TYPE: Record<string, HashFeatureType> = {
  point: 'point',
  socket: 'socket',
  route: 'route',
  bikelane: 'bikeLane',
};

/** Соответствие ключа слоя и типа в hash. */
export const LAYER_KEY_TO_HASH_TYPE: Record<LayerKey, HashFeatureType> = {
  points: 'point',
  sockets: 'socket',
  routes: 'route',
  bikeLanes: 'bikeLane',
};

/** Обратное соответствие: тип в hash → ключ слоя (для getFeatureById). */
export const HASH_TYPE_TO_LAYER_KEY: Record<HashFeatureType, LayerKey> = {
  point: 'points',
  socket: 'sockets',
  route: 'routes',
  bikeLane: 'bikeLanes',
};

/**
 * Парсит текущий hash или переданную строку.
 * Формат: #point=11, #route=123, #socket=5, #bikeLane=alm84
 */
export function parseHash(hashOrEmpty?: string): { type: HashFeatureType; id: string } | null {
  const raw = hashOrEmpty ?? (typeof window === 'undefined' ? '' : window.location.hash.slice(1));
  if (!raw.trim()) return null;
  const eq = raw.indexOf('=');
  if (eq <= 0) return null;
  const typeKey = raw.slice(0, eq).toLowerCase();
  const type = NORMALIZED_TYPE[typeKey];
  const id = raw.slice(eq + 1).trim();
  if (!id || !type) return null;
  return { type, id: decodeURIComponent(id) };
}

/**
 * Формирует строку hash для типа и id (без #).
 */
export function buildHash(type: HashFeatureType, id: string): string {
  return `${type}=${encodeURIComponent(id)}`;
}

/**
 * Устанавливает hash в URL без перезагрузки (replaceState).
 */
export function setHash(type: HashFeatureType, id: string): void {
  if (typeof window === 'undefined') return;
  const hash = buildHash(type, id);
  const url = new URL(window.location.href);
  url.hash = hash;
  window.history.replaceState(null, '', url.toString());
}

/**
 * Очищает hash в URL.
 */
export function clearHash(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', url.toString());
}
