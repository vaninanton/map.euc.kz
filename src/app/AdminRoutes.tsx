import { Navigate, Route } from 'react-router-dom'
import { AdminShell } from '@/admin/AdminShell'
import {
    AdminPointEditPage,
    AdminRouteEditPage,
    AdminPointsPage,
    AdminRoutesListPage,
    AdminSubmissionsPage,
} from '@/admin/lazyAdminPages'

/** Вложенные маршруты `/admin/*`. */
export function AdminRoutes() {
    return (
        <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Navigate to="submissions" replace />} />
            <Route path="submissions" element={<AdminSubmissionsPage />} />
            <Route path="points" element={<AdminPointsPage />} />
            <Route path="points/new" element={<AdminPointEditPage mode="create" />} />
            <Route path="points/:id" element={<AdminPointEditPage mode="edit" />} />
            <Route path="routes" element={<AdminRoutesListPage />} />
            <Route path="routes/new" element={<AdminRouteEditPage mode="create" />} />
            <Route path="routes/:id" element={<AdminRouteEditPage mode="edit" />} />
            <Route path="*" element={<Navigate to="submissions" replace />} />
        </Route>
    )
}
