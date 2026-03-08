// GeoJSON types for map features

export type Position = [number, number] | [number, number, number]; // [lon, lat] or [lon, lat, elevation]

export interface Point {
  type: 'Point';
  coordinates: [number, number];
}

export interface LineString {
  type: 'LineString';
  coordinates: Position[];
}

export type Geometry = Point | LineString;

export type FeatureType = 'point' | 'socket' | 'route' | 'bikeLane';

export interface FeatureProperties {
  id: string;
  name: string;
  description?: string | null;
  type: FeatureType;
  /** Точка — место встречи (только для type === 'point'). */
  isMeeting?: boolean;
  distance?: number;
  safetyLevel?: number;
}

export interface Feature<G extends Geometry = Geometry> {
  type: 'Feature';
  geometry: G;
  properties: FeatureProperties;
}

export interface FeatureCollection<G extends Geometry = Geometry> {
  type: 'FeatureCollection';
  features: Feature<G>[];
}

export type PointFeature = Feature<Point>;
export type LineStringFeature = Feature<LineString>;
