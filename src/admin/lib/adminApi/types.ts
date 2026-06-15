import type { MapPointType } from '@/types'

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
