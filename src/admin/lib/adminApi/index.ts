export type {
    AdminMapPoint,
    AdminMapRoute,
    AdminPhoto,
    AdminSubmission,
    MapPointInput,
    MapRouteInput,
    SubmissionStatus,
} from '@/admin/lib/adminApi/types'

export {
    listPoints,
    getPoint,
    createPoint,
    updatePoint,
    togglePointDisabled,
    deletePoint,
} from '@/admin/lib/adminApi/points'

export {
    listRoutes,
    getRoute,
    createRoute,
    updateRoute,
    toggleRouteDisabled,
    deleteRoute,
} from '@/admin/lib/adminApi/routes'

export { listSubmissions, approveSubmission, rejectSubmission } from '@/admin/lib/adminApi/submissions'

export { listPhotos, uploadPhoto, updatePhoto, deletePhoto } from '@/admin/lib/adminApi/photos'
