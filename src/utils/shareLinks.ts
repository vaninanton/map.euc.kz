import type { Feature, FeatureType } from '@/types/geojson';
import { buildHash } from '@/utils/hashNav';

export function buildYandexLink(lat: number, lon: number): string {
  return `https://yandex.ru/maps/?rtext=~${String(lat)},${String(lon)}&rtt=sc`;
}

export function build2GISLink(lat: number, lon: number, isMobile = false): string {
  const routeType = isMobile ? 'scooter' : 'pedestrian';
  return `https://2gis.kz/directions/tab/${routeType}/points/|${String(lon)},${String(lat)}`;
}

export function buildGuruPointLink(lat: number, lon: number): string {
  return `guru://nav?mode=bicycle&finish=${String(lat)},${String(lon)}`;
}

/**
 * Промежуточные точки маршрута (равномерно по длине), без первой и последней.
 * coords — [lon, lat][], minSteps — желаемое число via-точек.
 */
export function getViaPoints(coordinates: [number, number][], minSteps: number): [number, number][] {
  const coords = coordinates;
  if (coords.length <= 2) return [];

  const steps = Math.min(minSteps, coords.length - 2);
  const via: [number, number][] = [];

  for (let i = 1; i <= steps; i++) {
    const idx = Math.round((i / (steps + 1)) * (coords.length - 1));
    via.push([coords[idx][0], coords[idx][1]]);
  }

  return via;
}

/** Маршрут Guru: start + 4 равномерно распределённые via + finish (логика из CreateShareLinks). */
export function buildGuruRouteLink(coordinates: [number, number][]): string {
  if (coordinates.length === 0) return '';
  if (coordinates.length === 1) {
    const [lon, lat] = coordinates[0];
    return buildGuruPointLink(lat, lon);
  }

  const start = coordinates[0];
  const finish = coordinates[coordinates.length - 1];
  const viaPoints = getViaPoints(coordinates, 4);

  const url = new URL('guru://nav');
  url.searchParams.set('mode', 'bicycle');
  url.searchParams.set('start', `${String(start[1])},${String(start[0])}`);
  url.searchParams.set('finish', `${String(finish[1])},${String(finish[0])}`);
  viaPoints.forEach((v) => {
    url.searchParams.append('via', `${String(v[1])},${String(v[0])}`);
  });

  return url.href;
}

/** Classic OpenRouteService: до 40 точек (start + 38 via + finish), формат a=lat,lon,lat,lon,... */
const OPENROUTE_CLASSIC_BASE = 'https://classic-maps.openrouteservice.org/directions';

export function buildOpenRouteLink(coordinates: [number, number][]): string {
  if (coordinates.length < 2) return '';

  const start = coordinates[0];
  const finish = coordinates[coordinates.length - 1];
  const viaPoints = getViaPoints(coordinates, 38);
  const a: string[] = [
    `${String(start[1])},${String(start[0])}`,
    ...viaPoints.map((v) => `${String(v[1])},${String(v[0])}`),
    `${String(finish[1])},${String(finish[0])}`,
  ];

  const url = new URL(OPENROUTE_CLASSIC_BASE);
  url.searchParams.set('b', '1f');
  url.searchParams.set('c', '0');
  url.searchParams.set('a', a.join(','));
  return url.href;
}

export function buildAppShareLink(type: FeatureType, id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${origin}${pathname}#${buildHash(type, id)}`;
}

export function buildTelegramPointMessage(pointName: string): string {
  return pointName;
}

export function buildTelegramShareLink(shareUrl: string, text: string): string {
  const telegramUrl = new URL('https://t.me/share/url');
  telegramUrl.searchParams.set('url', shareUrl);
  telegramUrl.searchParams.set('text', text);
  return telegramUrl.toString();
}

export function getCoordsFromFeature(feature: Feature): { lat: number; lon: number } | null {
  const g = feature.geometry;
  if (g.type === 'Point') {
    return { lon: g.coordinates[0], lat: g.coordinates[1] };
  }
  if (g.coordinates.length > 0) {
    const c = g.coordinates[0];
    return { lon: c[0], lat: c[1] };
  }
  return null;
}

export function getCoordinatesArray(feature: Feature): [number, number][] {
  const g = feature.geometry;
  if (g.type === 'Point') {
    return [[g.coordinates[0], g.coordinates[1]]];
  }
  return g.coordinates.map((c) => [c[0], c[1]]);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyOrShare(url: string, title?: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- share отсутствует в старых браузерах
  if (navigator.share !== undefined) {
    try {
      await navigator.share({ url, title: title ?? 'Мономаршруты' });
      return true;
    } catch {
      // fallback to copy
    }
  }
  return copyToClipboard(url);
}
