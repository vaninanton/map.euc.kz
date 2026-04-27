// Map center — Almaty
export const MAP_CENTER: [number, number] = [76.904848, 43.226807];
export const MAP_ZOOM_DEFAULT = 12;
export const MAP_ZOOM_FOCUS = 15;

export const MAPBOX_STYLES = {
  streets: 'mapbox://styles/vanton/cmcw742a0002m01s945vc1s0n',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

/** Id слоёв с префиксом, чтобы не пересекаться со слоями стиля Mapbox. */
export const LAYER_IDS = {
  points: 'euc-points',
  sockets: 'euc-sockets',
  routes: 'euc-routes',
  bikeLanes: 'euc-bike-lanes',
} as const;

/** Слои, по которым обрабатываются клик и ховер. */
export const CLICKABLE_LAYER_IDS = [
  LAYER_IDS.points,
  LAYER_IDS.sockets,
  LAYER_IDS.routes,
  LAYER_IDS.bikeLanes,
] as const;

export type LayerKey = 'points' | 'sockets' | 'routes' | 'bikeLanes';

export const LAYER_ID_TO_KEY = Object.fromEntries(
  (Object.entries(LAYER_IDS) as [LayerKey, string][]).map(([key, id]) => [id, key])
) as Record<(typeof LAYER_IDS)[LayerKey], LayerKey>;

export const SOURCE_IDS = {
  points: 'points-source',
  sockets: 'sockets-source',
  routes: 'routes-source',
  bikeLanes: 'bike-lanes-source',
} as const;

/** Соответствие слой → источник (для feature-state). */
export const LAYER_ID_TO_SOURCE: Record<(typeof LAYER_IDS)[LayerKey], string> = {
  [LAYER_IDS.points]: SOURCE_IDS.points,
  [LAYER_IDS.sockets]: SOURCE_IDS.points,
  [LAYER_IDS.routes]: SOURCE_IDS.routes,
  [LAYER_IDS.bikeLanes]: SOURCE_IDS.bikeLanes,
};

export const COLORS = {
  point: '#2563eb',
  socket: '#eab308',
  route: '#f25824',
  bikeLane: '#2563eb',
} as const;

export const FEATURE_TYPE_LABELS: Record<string, string> = {
  point: 'Точка',
  socket: 'Розетка',
  route: 'Маршрут',
  bikeLane: 'Велодорожка',
};

/** Подпись флага «место встречи» для popup. */
export const POINT_FLAG_LABELS: Record<string, string> = {
  meeting: 'Место встречи',
};
