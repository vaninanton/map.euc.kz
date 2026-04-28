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

interface BaseFeatureProperties {
  id: string;
  name: string;
  description?: string | null;
}

export interface PointProperties extends BaseFeatureProperties {
  type: 'point';
  /** Точка — место встречи. */
  isMeeting?: boolean;
  /** Для точки доступна зарядка. */
  hasSocket?: boolean;
}

export interface SocketProperties extends BaseFeatureProperties {
  type: 'socket';
}

export interface RouteProperties extends BaseFeatureProperties {
  type: 'route';
  distance?: number;
}

export interface BikeLaneProperties extends BaseFeatureProperties {
  type: 'bikeLane';
  distance?: number;
  safetyLevel?: number;
}

export type FeatureProperties =
  | PointProperties
  | SocketProperties
  | RouteProperties
  | BikeLaneProperties;

export interface Feature<
  G extends Geometry = Geometry,
  P extends FeatureProperties = FeatureProperties,
> {
  type: 'Feature';
  geometry: G;
  properties: P;
}

export interface FeatureCollection<
  G extends Geometry = Geometry,
  P extends FeatureProperties = FeatureProperties,
> {
  type: 'FeatureCollection';
  features: Array<Feature<G, P>>;
}

export type PointFeature = Feature<Point, PointProperties | SocketProperties>;
export type RouteFeature = Feature<LineString, RouteProperties>;
export type BikeLaneFeature = Feature<LineString, BikeLaneProperties>;
export type LineStringFeature = RouteFeature | BikeLaneFeature;
