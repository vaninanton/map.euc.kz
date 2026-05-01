import { describe, expect, it } from 'vitest';
import { computeRouteStats } from '@/utils/routeStats';
import type { Position, RouteFeature } from '@/types/geojson';

function route(coords: Position[]): RouteFeature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: { id: '1', type: 'route', name: 'Test' },
  };
}

describe('computeRouteStats', () => {
  it('считает длину для двух точек', () => {
    const stats = computeRouteStats(
      route([
        [76.9, 43.2],
        [76.91, 43.21],
      ])
    );
    expect(stats.distanceKm).toBeGreaterThan(0);
    expect(stats.distanceKm).toBeLessThan(5);
    expect(stats.ascentM).toBe(0);
    expect(stats.descentM).toBe(0);
  });

  it('учитывает наборот и сброс по высотам', () => {
    const stats = computeRouteStats(
      route([
        [0, 0, 100],
        [0.01, 0, 150],
        [0.02, 0, 120],
      ])
    );
    expect(stats.ascentM + stats.descentM).toBeGreaterThan(0);
    expect(stats.elevationMin).toBe(100);
    expect(stats.elevationMax).toBe(150);
  });
});
