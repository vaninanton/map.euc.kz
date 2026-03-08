// Supabase table row types

export type MapPointType = 'point' | 'socket';

export interface MapPointRow {
  id: string;
  type: MapPointType;
  /** Точка — место встречи. */
  is_meeting?: boolean | null;
  title: string;
  description: string | null;
  coordinates: [number, number]; // [lon, lat]
}

export interface MapRouteRow {
  id: string;
  title: string;
  description: string | null;
  coordinates: Array<[number, number] | [number, number, number]>; // [lon, lat] or [lon, lat, elevation]
}
