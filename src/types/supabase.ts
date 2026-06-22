// Supabase table row types

export type MapPointType = 'point' | 'socket'

export interface MapPointPhotoRow {
    id: string
    bucket_name: string
    storage_path: string
    alt_text: string | null
    sort_order: number
    public_url: string
}

export interface MapPointRow {
    id: string
    type: MapPointType
    /** Точка — место встречи. */
    flag_is_meeting?: boolean | null
    /** Для точки доступна зарядка. */
    flag_has_socket?: boolean | null
    /** Ерландия — проезжает только Ерлан. */
    flag_erlan?: boolean | null
    title: string
    description: string | null
    coordinates: [number, number] // [lon, lat]
    photos: MapPointPhotoRow[]
}

export interface MapPointDraftInput {
    type: MapPointType
    flag_is_meeting?: boolean | null
    title: string
    description: string | null
    coordinates: [number, number]
}

export interface MapRouteRow {
    id: string
    title: string
    description: string | null
    coordinates: Array<[number, number] | [number, number, number]> // [lon, lat] or [lon, lat, elevation]
    via_coordinates: Array<[number, number]> // [lon, lat]
    /** Ерландия — проезжает только Ерлан. */
    flag_erlan?: boolean | null
}

export interface TelegramLocationRow {
    id: string
    created_at: string
    chat_id: number
    chat_title: string | null
    telegram_user_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    longitude: number
    latitude: number
    location_accuracy_meters: number | null
}

export interface TelegramProfileRow {
    telegram_user_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    updated_at: string
}

export type EventType = 'group_ride' | 'event' | 'training'

/** Одна дата проведения события. */
export interface EventDateRow {
    id: string
    /** Дата-время вхождения, ISO. */
    starts_at: string
    note: string | null
    /** Дата разово отменена. */
    cancelled: boolean
}

export interface EventRow {
    id: string
    created_at: string
    type: EventType
    title: string
    description: string | null
    /** Публичный URL фотографии (вычисляется при нормализации). */
    photo_url: string | null
    duration_minutes: number | null
    location_text: string | null
    /** Ручные координаты старта (если точка не привязана). */
    start_coordinates: [number, number] | null
    /** Ручные координаты финиша (если точка не привязана). */
    finish_coordinates: [number, number] | null
    /** Привязанная точка-старт (приоритетнее ручных координат). */
    start_point: EventLinkedPoint | null
    /** Привязанная точка-финиш (приоритетнее ручных координат). */
    finish_point: EventLinkedPoint | null
    /** Даты проведения (одна — разовое, несколько — повторяющееся). */
    dates: EventDateRow[]
}

/** Точка, привязанная к событию как старт или финиш. */
export interface EventLinkedPoint {
    id: string
    title: string
    coordinates: [number, number]
}
