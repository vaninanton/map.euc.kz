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
