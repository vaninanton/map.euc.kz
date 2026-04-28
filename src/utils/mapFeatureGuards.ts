import type { Feature, FeatureType, RouteFeature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import { LAYER_ID_TO_KEY, LAYER_ID_TO_SOURCE } from '@/constants';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isFeatureType(value: unknown): value is FeatureType {
  return value === 'point' || value === 'socket' || value === 'route' || value === 'bikeLane' || value === 'telegramUser';
}

export function isLayerKey(value: unknown): value is LayerKey {
  return value === 'points' || value === 'sockets' || value === 'routes' || value === 'bikeLanes' || value === 'telegramUsers';
}

export function getLayerKeyById(layerId: string): LayerKey | null {
  if (layerId in LAYER_ID_TO_KEY) {
    return LAYER_ID_TO_KEY[layerId as keyof typeof LAYER_ID_TO_KEY];
  }
  return null;
}

export function getSourceIdByLayerId(layerId: string): string | null {
  if (layerId in LAYER_ID_TO_SOURCE) {
    return LAYER_ID_TO_SOURCE[layerId as keyof typeof LAYER_ID_TO_SOURCE];
  }
  return null;
}

export function getStringProperty(
  properties: unknown,
  key: string
): string | null {
  if (!isRecord(properties)) return null;
  const value = properties[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function getFeatureId(feature: Feature): string {
  return String(feature.properties.id);
}

export function isRouteFeature(feature: Feature): feature is RouteFeature {
  return feature.geometry.type === 'LineString' && feature.properties.type === 'route';
}
