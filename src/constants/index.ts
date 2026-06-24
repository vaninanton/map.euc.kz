// Map center — Almaty
export const MAP_CENTER: [number, number] = [76.904848, 43.226807]
export const MAP_ZOOM_DEFAULT = 12
export const MAP_ZOOM_FOCUS = 15

export const MAPBOX_STYLES = {
    streets: 'mapbox://styles/vanton/cmcw742a0002m01s945vc1s0n',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const

/** Id слоёв с префиксом, чтобы не пересекаться со слоями стиля Mapbox. */
export const LAYER_IDS = {
    points: 'euc-points',
    sockets: 'euc-sockets',
    routes: 'euc-routes',
    bikeLanes: 'euc-bike-lanes',
    telegramUsers: 'euc-telegram-users',
    telegramTracks: 'euc-telegram-tracks',
    telegramAvatars: 'euc-telegram-avatars',
} as const

/** Слои, по которым обрабатываются клик и ховер. */
export const CLICKABLE_LAYER_IDS = [
    LAYER_IDS.points,
    LAYER_IDS.sockets,
    LAYER_IDS.routes,
    LAYER_IDS.bikeLanes,
    LAYER_IDS.telegramTracks,
    LAYER_IDS.telegramUsers,
] as const

export type LayerKey = 'points' | 'sockets' | 'routes' | 'bikeLanes' | 'telegramUsers'

export const LAYER_ID_TO_KEY = {
    [LAYER_IDS.points]: 'points',
    [LAYER_IDS.sockets]: 'sockets',
    [LAYER_IDS.routes]: 'routes',
    [LAYER_IDS.bikeLanes]: 'bikeLanes',
    [LAYER_IDS.telegramUsers]: 'telegramUsers',
    [LAYER_IDS.telegramTracks]: 'telegramUsers',
    [LAYER_IDS.telegramAvatars]: 'telegramUsers',
} as const satisfies Record<(typeof LAYER_IDS)[keyof typeof LAYER_IDS], LayerKey>

export const SOURCE_IDS = {
    points: 'points-source',
    sockets: 'sockets-source',
    routes: 'routes-source',
    bikeLanes: 'bike-lanes-source',
    telegramUsers: 'telegram-users-source',
} as const

/** Соответствие слой → источник (для feature-state). */
export const LAYER_ID_TO_SOURCE: Record<(typeof LAYER_IDS)[keyof typeof LAYER_IDS], string> = {
    [LAYER_IDS.points]: SOURCE_IDS.points,
    [LAYER_IDS.sockets]: SOURCE_IDS.points,
    [LAYER_IDS.routes]: SOURCE_IDS.routes,
    [LAYER_IDS.bikeLanes]: SOURCE_IDS.bikeLanes,
    [LAYER_IDS.telegramUsers]: SOURCE_IDS.telegramUsers,
    [LAYER_IDS.telegramTracks]: SOURCE_IDS.telegramUsers,
    [LAYER_IDS.telegramAvatars]: SOURCE_IDS.telegramUsers,
}

/**
 * Единственный источник цветов проекта — и для карты (paint-выражения Mapbox),
 * и для интерфейса. UI берёт акценты отсюда (см. UI_ACCENT), карта и UI не расходятся.
 */
export const COLORS = {
    point: '#2563eb',
    socket: '#eab308',
    route: '#f25824',
    bikeLane: '#2563eb',
    telegramUser: '#8b5cf6',
    telegramTrack: '#a855f7',
    erlan: '#a855f7', // фиолетовый флага «Ерландия» — внутренний мем в честь Ерлана (заезжает в оффроад дальше и круче всех); флаг есть у точек и маршрутов
} as const

/**
 * Акцентные цвета элементов интерфейса (тумблеры, активные фильтры, иконки в шапках).
 * Все значения берутся из COLORS — карта и UI используют одни и те же цвета.
 * Ключи здесь — семантика UI, маппинг на цвета карты.
 */
export const UI_ACCENT = {
    meeting: COLORS.point, // места встреч — цвет точек
    socket: COLORS.socket, // розетка — как на карте
    erlan: COLORS.erlan, // Ерландия — фиолетовый
    route: COLORS.route, // маршрут
    point: COLORS.point, // точки
    satellite: '#737373', // спутник — нейтральный, аналога на карте нет
} as const

export const FEATURE_TYPE_LABELS: Record<string, string> = {
    point: 'Точка',
    socket: 'Розетка',
    route: 'Маршрут',
    bikeLane: 'Велодорожка',
    telegramUser: 'Райдер',
}

/** Подпись флага «место встречи» для popup. */
export const POINT_FLAG_LABELS: Record<string, string> = {
    meeting: 'Место встречи',
}

/** Русские подписи типов событий. */
export const EVENT_TYPE_LABELS: Record<string, string> = {
    group_ride: 'Покатушка',
    event: 'Мероприятие',
    training: 'Обучение',
}
