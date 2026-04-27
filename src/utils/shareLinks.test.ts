import { describe, expect, it } from 'vitest';
import {
  build2GISLink,
  buildGuruRouteLink,
  buildOpenRouteLink,
  getViaPoints,
} from '@/utils/shareLinks';

describe('shareLinks smoke', () => {
  it('build2GISLink использует pedestrian/scooter в зависимости от mobile', () => {
    expect(build2GISLink(43.25, 76.95, false)).toContain('/pedestrian/');
    expect(build2GISLink(43.25, 76.95, true)).toContain('/scooter/');
  });

  it('getViaPoints возвращает промежуточные точки без первой и последней', () => {
    const points: [number, number][] = [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ];
    const via = getViaPoints(points, 2);
    expect(via).toHaveLength(2);
    expect(via).not.toContainEqual([1, 1]);
    expect(via).not.toContainEqual([5, 5]);
  });

  it('buildGuruRouteLink включает start/finish и via параметры', () => {
    const url = buildGuruRouteLink([
      [76.9, 43.2],
      [76.91, 43.21],
      [76.92, 43.22],
      [76.93, 43.23],
    ]);
    expect(url.startsWith('guru://nav?')).toBe(true);
    expect(url).toContain('start=');
    expect(url).toContain('finish=');
    expect(url).toContain('via=');
  });

  it('buildOpenRouteLink возвращает пустую строку для короткого маршрута', () => {
    expect(buildOpenRouteLink([])).toBe('');
    expect(buildOpenRouteLink([[76.9, 43.2]])).toBe('');
  });
});
