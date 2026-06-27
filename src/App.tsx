import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { YandexMetrika } from '@/components/YandexMetrika'
import { PwaPrompts } from '@/components/PwaPrompts'
import { MapShell } from '@/app/MapShell'
import { NotFound } from '@/app/NotFound'
import { AdminShell } from '@/admin/AdminShell'
import {
    AdminPointEditPage,
    AdminRouteEditPage,
    AdminPointsPage,
    AdminRoutesListPage,
    AdminSubmissionsPage,
    AdminGeoPage,
    AdminEventsPage,
    AdminEventEditPage,
    AdminTelegramChatsPage,
    AdminNewsPage,
    AdminNewsEditPage,
} from '@/admin/lazyAdminPages'

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <YandexMetrika />
            <Routes>
                <Route path="/" element={<MapShell />} />
                <Route path="radar" element={<MapShell />} />
                <Route path="events" element={<MapShell />} />
                <Route path="events/:eventId" element={<MapShell />} />
                <Route path="help" element={<MapShell />} />
                <Route path="m/:mapFeatureType/:mapFeatureId" element={<MapShell />} />
                <Route path="/admin" element={<AdminShell />}>
                    <Route index element={<Navigate to="submissions" replace />} />
                    <Route path="submissions" element={<AdminSubmissionsPage />} />
                    <Route path="point" element={<AdminPointsPage />} />
                    <Route path="point/new" element={<AdminPointEditPage mode="create" />} />
                    <Route path="point/:id" element={<AdminPointEditPage mode="edit" />} />
                    <Route path="route" element={<AdminRoutesListPage />} />
                    <Route path="route/new" element={<AdminRouteEditPage mode="create" />} />
                    <Route path="route/:id" element={<AdminRouteEditPage mode="edit" />} />
                    <Route path="event" element={<AdminEventsPage />} />
                    <Route path="event/new" element={<AdminEventEditPage mode="create" />} />
                    <Route path="event/:id" element={<AdminEventEditPage mode="edit" />} />
                    <Route path="news" element={<AdminNewsPage />} />
                    <Route path="news/new" element={<AdminNewsEditPage mode="create" />} />
                    <Route path="news/:id" element={<AdminNewsEditPage mode="edit" />} />
                    <Route path="telegram-chats" element={<AdminTelegramChatsPage />} />
                    <Route path="geo" element={<AdminGeoPage />} />
                    <Route path="*" element={<Navigate to="/admin/submissions" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
            </Routes>
            <PwaPrompts />
        </BrowserRouter>
    )
}
