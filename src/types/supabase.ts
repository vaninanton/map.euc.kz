// Supabase table row types

export type MapPointType = 'point' | 'socket';

export interface MapPointPhotoRow {
  id: string;
  bucket_name: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  public_url: string;
}

export interface MapPointRow {
  id: string;
  type: MapPointType;
  /** Точка — место встречи. */
  flag_is_meeting?: boolean | null;
  /** Для точки доступна зарядка. */
  flag_has_socket?: boolean | null;
  title: string;
  description: string | null;
  coordinates: [number, number]; // [lon, lat]
  photos: MapPointPhotoRow[];
}

export interface MapPointDraftInput {
  type: MapPointType;
  flag_is_meeting?: boolean | null;
  title: string;
  description: string | null;
  coordinates: [number, number];
}

export interface MapRouteRow {
  id: string;
  title: string;
  description: string | null;
  coordinates: Array<[number, number] | [number, number, number]>; // [lon, lat] or [lon, lat, elevation]
}
