import { lazy } from 'react'

export const AdminSubmissionsPage = lazy(async () => {
    const m = await import('@/admin/pages/SubmissionsPage')
    return { default: m.SubmissionsPage }
})

export const AdminPointsPage = lazy(async () => {
    const m = await import('@/admin/pages/PointsPage')
    return { default: m.PointsPage }
})

/** Не путать с `Routes` из react-router-dom. */
export const AdminRoutesListPage = lazy(async () => {
    const m = await import('@/admin/pages/RoutesPage')
    return { default: m.RoutesPage }
})

export const AdminPointEditPage = lazy(async () => {
    const m = await import('@/admin/pages/PointEditPage')
    return { default: m.PointEditPage }
})

export const AdminRouteEditPage = lazy(async () => {
    const m = await import('@/admin/pages/RouteEditPage')
    return { default: m.RouteEditPage }
})

export const AdminGeoPage = lazy(async () => {
    const m = await import('@/admin/pages/GeoPage')
    return { default: m.GeoPage }
})

export const AdminEventsPage = lazy(async () => {
    const m = await import('@/admin/pages/EventsPage')
    return { default: m.EventsPage }
})

export const AdminEventEditPage = lazy(async () => {
    const m = await import('@/admin/pages/EventEditPage')
    return { default: m.EventEditPage }
})

export const AdminTelegramChatsPage = lazy(async () => {
    const m = await import('@/admin/pages/TelegramChatsPage')
    return { default: m.TelegramChatsPage }
})
