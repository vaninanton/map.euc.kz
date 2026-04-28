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

export interface TelegramLocationRow {
  id: string;
  created_at: string;
  chat_id: number;
  chat_title: string | null;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  longitude: number;
  latitude: number;
}

export interface TelegramProfileRow {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  updated_at: string;
}
