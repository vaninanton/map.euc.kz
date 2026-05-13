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
} from '@/admin/lazyAdminPages'

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <YandexMetrika />
            <Routes>
                <Route path="/" element={<MapShell />} />
                <Route path="radar" element={<MapShell />} />
                <Route path="m/:mapFeatureType/:mapFeatureId" element={<MapShell />} />
                <Route path="/admin" element={<AdminShell />}>
                    <Route index element={<Navigate to="submissions" replace />} />
                    <Route path="submissions" element={<AdminSubmissionsPage />} />
                    <Route path="points" element={<AdminPointsPage />} />
                    <Route path="points/new" element={<AdminPointEditPage mode="create" />} />
                    <Route path="points/:id" element={<AdminPointEditPage mode="edit" />} />
                    <Route path="routes" element={<AdminRoutesListPage />} />
                    <Route path="routes/new" element={<AdminRouteEditPage mode="create" />} />
                    <Route path="routes/:id" element={<AdminRouteEditPage mode="edit" />} />
                    <Route path="geo" element={<AdminGeoPage />} />
                    <Route path="*" element={<Navigate to="submissions" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
            </Routes>
            <PwaPrompts />
        </BrowserRouter>
    )
}
