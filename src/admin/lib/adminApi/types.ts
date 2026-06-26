import type { MapPointType, EventType } from '@/types'

export interface AdminMapPoint {
    id: number
    created_at: string
    type: MapPointType
    title: string
    description: string | null
    coordinates: [number, number]
    flag_is_meeting: boolean
    flag_has_socket: boolean
    flag_erlan: boolean
    flag_disabled: boolean
    photo_count: number
}

export interface AdminMapRoute {
    id: number
    created_at: string
    title: string
    description: string | null
    coordinates: Array<[number, number] | [number, number, number]>
    via_coordinates: Array<[number, number]>
    flag_erlan: boolean
    flag_disabled: boolean
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface AdminSubmission {
    id: string
    created_at: string
    processed_at: string | null
    type: MapPointType
    title: string
    description: string | null
    coordinates: [number, number]
    flag_is_meeting: boolean
    status: SubmissionStatus
}

export interface AdminPhoto {
    id: string
    created_at: string
    point_id: number
    bucket_name: string
    storage_path: string
    alt_text: string | null
    sort_order: number
    public_url: string
}

export interface MapPointInput {
    type: MapPointType
    title: string
    description: string | null
    coordinates: [number, number]
    flag_is_meeting: boolean
    flag_has_socket: boolean
    flag_erlan: boolean
    flag_disabled: boolean
}

export interface MapRouteInput {
    title: string
    description: string | null
    coordinates: Array<[number, number] | [number, number, number]>
    via_coordinates: Array<[number, number]>
    flag_erlan: boolean
    flag_disabled: boolean
}

export interface AdminEventDate {
    id: string
    starts_at: string
    note: string | null
    cancelled: boolean
}

export interface AdminEvent {
    id: number
    created_at: string
    type: EventType
    title: string
    description: string | null
    photo_path: string | null
    duration_minutes: number | null
    location_text: string | null
    start_coordinates: [number, number] | null
    finish_coordinates: [number, number] | null
    start_point_id: number | null
    finish_point_id: number | null
    flag_disabled: boolean
}

export interface EventInput {
    type: EventType
    title: string
    description: string | null
    duration_minutes: number | null
    location_text: string | null
    start_coordinates: [number, number] | null
    finish_coordinates: [number, number] | null
    start_point_id: number | null
    finish_point_id: number | null
    flag_disabled: boolean
}

export interface EventDateInput {
    starts_at: string
    note: string | null
}

export interface EventDatePatch {
    starts_at?: string
    note?: string | null
    cancelled?: boolean
}

export interface AdminEventParticipant {
    telegram_user_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    created_at: string
}

export interface AdminEventAnnouncement {
    id: string
    created_at: string
    event_date_id: string
    telegram_chat_id: number
    /** Тема форумной группы, куда отправлен анонс (null — обычный чат/General). */
    message_thread_id: number | null
    telegram_message_id: number | null
    /** Сырое тело анонса (без шапки и HTML-эскейпа) — для повторной правки. */
    body_text: string
    /** Путь к изображению анонса в Storage (null — без картинки). */
    photo_path: string | null
    sent_at: string | null
    send_error: string | null
    cancelled_at: string | null
    deleted_at: string | null
    /** Время закрепления в чате (null — не закреплено). */
    pinned_at: string | null
}

export interface AnnounceResult {
    sent: Array<{ chat_id: number; message_id: number; pinned?: boolean }>
    failed: Array<{ chat_id: number; error: string }>
}

export interface AdminTelegramChat {
    /** Суррогатный ключ назначения (чат + тема). Один chat_id может иметь несколько тем. */
    id: string
    chat_id: number
    title: string
    enabled: boolean
    sort_order: number
    created_at: string
    /** ID темы форумной группы для отправки анонса (null — обычный чат/General). */
    message_thread_id: number | null
}

export interface TelegramChatInput {
    chat_id: number
    title: string
    enabled: boolean
    sort_order: number
    message_thread_id?: number | null
}

export interface TelegramChatPatch {
    title?: string
    enabled?: boolean
    sort_order?: number
    message_thread_id?: number | null
}
