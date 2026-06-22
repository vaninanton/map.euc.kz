export type {
    AdminMapPoint,
    AdminMapRoute,
    AdminPhoto,
    AdminSubmission,
    AdminEvent,
    AdminEventDate,
    MapPointInput,
    MapRouteInput,
    EventInput,
    EventDateInput,
    EventDatePatch,
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

export {
    listEvents,
    getEvent,
    createEvent,
    updateEvent,
    toggleEventDisabled,
    deleteEvent,
    setEventPhoto,
    deleteEventPhoto,
    eventPhotoUrl,
    listEventDates,
    addEventDate,
    updateEventDate,
    deleteEventDate,
} from '@/admin/lib/adminApi/events'
