import { describe, expect, it } from 'vitest';
import type { Feature } from '@/types/geojson';
import { LAYER_IDS, SOURCE_IDS } from '@/constants';
import {
  getFeatureId,
  getLayerKeyById,
  getSourceIdByLayerId,
  getStringProperty,
  isFeatureType,
  isLayerKey,
  isRouteFeature,
} from '@/utils/mapFeatureGuards';

describe('mapFeatureGuards smoke', () => {
  it('маппит layer id в layer key/source id', () => {
    expect(getLayerKeyById(LAYER_IDS.routes)).toBe('routes');
    expect(getSourceIdByLayerId(LAYER_IDS.routes)).toBe(SOURCE_IDS.routes);
    expect(getLayerKeyById('unknown')).toBeNull();
  });

  it('валидирует feature/layer типы', () => {
    expect(isFeatureType('point')).toBe(true);
    expect(isFeatureType('other')).toBe(false);
    expect(isLayerKey('bikeLanes')).toBe(true);
    expect(isLayerKey('bike')).toBe(false);
  });

  it('безопасно читает строковые свойства', () => {
    expect(getStringProperty({ id: '123' }, 'id')).toBe('123');
    expect(getStringProperty({ id: '   ' }, 'id')).toBeNull();
    expect(getStringProperty(null, 'id')).toBeNull();
  });

  it('определяет route feature и возвращает id', () => {
    const routeFeature: Feature = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[76.9, 43.2], [76.91, 43.21]] },
      properties: { id: 'r1', name: 'Route', type: 'route' },
    };
    const pointFeature: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [76.9, 43.2] },
      properties: { id: 'p1', name: 'Point', type: 'point' },
    };

    expect(isRouteFeature(routeFeature)).toBe(true);
    expect(isRouteFeature(pointFeature)).toBe(false);
    expect(getFeatureId(routeFeature)).toBe('r1');
  });
});
