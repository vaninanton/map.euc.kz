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
  telegramuser: 'telegramUser',
};

/** Соответствие ключа слоя и типа в hash. */
export const LAYER_KEY_TO_HASH_TYPE: Record<LayerKey, HashFeatureType> = {
  points: 'point',
  sockets: 'socket',
  routes: 'route',
  bikeLanes: 'bikeLane',
  telegramUsers: 'telegramUser',
};

/** Обратное соответствие: тип в hash → ключ слоя (для getFeatureById). */
export const HASH_TYPE_TO_LAYER_KEY: Record<HashFeatureType, LayerKey> = {
  point: 'points',
  socket: 'sockets',
  route: 'routes',
  bikeLane: 'bikeLanes',
  telegramUser: 'telegramUsers',
};

/** Сегмент пути после basename: `/m/point/…`, чтобы не пересекаться с `/admin` и др. */
export const MAP_DEEP_LINK_PREFIX = 'm' as const

/** Сегмент URL (как в hash, lower-case) → тип фичи. */
const PATH_SEG_TO_TYPE: Record<string, HashFeatureType> = {
  point: 'point',
  socket: 'socket',
  route: 'route',
  bikelane: 'bikeLane',
  telegramuser: 'telegramUser',
}

/** Тип фичи → сегмент в пути deep-link. */
const TYPE_TO_PATH_SEG: Record<HashFeatureType, string> = {
  point: 'point',
  socket: 'socket',
  route: 'route',
  bikeLane: 'bikelane',
  telegramUser: 'telegramuser',
}

/**
 * Относительный путь deep-link без ведущего слэша: `m/point/11`.
 * id кодируется через encodeURIComponent.
 */
export function buildMapDeepLinkPath(type: HashFeatureType, id: string): string {
  const seg = TYPE_TO_PATH_SEG[type]
  return `${MAP_DEEP_LINK_PREFIX}/${seg}/${encodeURIComponent(id)}`
}

/**
 * Разбор pathname из react-router (уже без basename): `/m/point/11`.
 */
export function parseMapDeepLinkPathname(pathname: string): { type: HashFeatureType; id: string } | null {
  const trimmed = pathname.replace(/\/+$/, '')
  const parts = trimmed.split('/').filter(Boolean)
  if (parts.length !== 3 || parts[0] !== MAP_DEEP_LINK_PREFIX) return null
  const rawSeg = parts[1].toLowerCase()
  if (!(rawSeg in PATH_SEG_TO_TYPE)) return null
  const id = decodeURIComponent(parts[2])
  if (!id) return null
  return { type: PATH_SEG_TO_TYPE[rawSeg], id }
}

/**
 * Парсит текущий hash или переданную строку.
 * Формат: #point=11, #route=123, #socket=5, #bikeLane=alm84, #telegramUser=777
 */
export function parseHash(hashOrEmpty?: string): { type: HashFeatureType; id: string } | null {
  const raw = hashOrEmpty ?? (typeof window === 'undefined' ? '' : window.location.hash.slice(1));
  if (!raw.trim()) return null;
  const eq = raw.indexOf('=');
  if (eq <= 0) return null;
  const typeKey = raw.slice(0, eq).toLowerCase();
  if (!(typeKey in NORMALIZED_TYPE)) return null;
  const type = NORMALIZED_TYPE[typeKey];
  const id = raw.slice(eq + 1).trim();
  if (!id) return null;
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
