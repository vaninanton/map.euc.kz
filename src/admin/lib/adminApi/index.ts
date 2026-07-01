export type {
    AdminMapPoint,
    AdminMapRoute,
    AdminPhoto,
    AdminSubmission,
    AdminEvent,
    AdminEventDate,
    AdminEventParticipant,
    AdminEventAnnouncement,
    AdminNews,
    NewsInput,
    AdminNewsAnnouncement,
    AnnounceResult,
    AdminTelegramChat,
    TelegramChatInput,
    TelegramChatPatch,
    MapPointInput,
    MapRouteInput,
    EventInput,
    EventDateInput,
    EventDatePatch,
    SubmissionStatus,
    AdminDashboardStats,
    DashboardDailyActivity,
    DashboardRiderCounts,
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

export {
    listSubmissions,
    approveSubmission,
    rejectSubmission,
    countPendingSubmissions,
} from '@/admin/lib/adminApi/submissions'

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

export {
    announceEventDate,
    cancelEventDateAnnouncements,
    editEventDateAnnouncements,
    deleteEventDateAnnouncements,
    pinEventAnnouncement,
    listEventParticipants,
    listEventAnnouncements,
    listEventAnnouncementsForDates,
} from '@/admin/lib/adminApi/eventAnnouncements'

export {
    listTelegramChats,
    createTelegramChat,
    updateTelegramChat,
    deleteTelegramChat,
} from '@/admin/lib/adminApi/telegramChats'

export {
    listNews,
    getNews,
    createNews,
    updateNews,
    deleteNews,
    setNewsPhoto,
    deleteNewsPhoto,
    newsPhotoUrl,
} from '@/admin/lib/adminApi/news'

export {
    announceNews,
    editNewsAnnouncements,
    deleteNewsAnnouncements,
    listNewsAnnouncements,
} from '@/admin/lib/adminApi/newsAnnouncements'

export { getDashboardStats } from '@/admin/lib/adminApi/dashboard'
