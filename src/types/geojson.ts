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

export type FeatureType = 'point' | 'socket' | 'route' | 'bikeLane' | 'telegramUser';

interface BaseFeatureProperties {
  id: string;
  name: string;
  description?: string | null;
}

export interface PointPhoto {
  id: string;
  url: string;
  alt?: string | null;
  sortOrder: number;
}

export interface PointProperties extends BaseFeatureProperties {
  type: 'point';
  /** Точка — место встречи. */
  isMeeting?: boolean;
  /** Для точки доступна зарядка. */
  hasSocket?: boolean;
  photos?: PointPhoto[];
}

export interface SocketProperties extends BaseFeatureProperties {
  type: 'socket';
  photos?: PointPhoto[];
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

export interface TelegramUserProperties extends BaseFeatureProperties {
  type: 'telegramUser';
  telegramUserId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  updatedAt: string;
  ageMinutes?: number;
  avatarUrl?: string;
  avgSpeedKmh?: number | null;
  avgSpeedWindowPoints?: number;
}

export type FeatureProperties =
  | PointProperties
  | SocketProperties
  | RouteProperties
  | BikeLaneProperties
  | TelegramUserProperties;

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

export type PointFeature = Feature<Point, PointProperties | SocketProperties | TelegramUserProperties>;
export type RouteFeature = Feature<LineString, RouteProperties>;
export type BikeLaneFeature = Feature<LineString, BikeLaneProperties>;
export type LineStringFeature = RouteFeature | BikeLaneFeature;
