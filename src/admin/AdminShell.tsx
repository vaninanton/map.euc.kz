import { AdminAuthGate } from '@/admin/AdminAuthGate'
import { AdminLayout } from '@/admin/AdminLayout'

/** Обёртка для вложенных маршрутов `/admin/*`: Auth → Layout с Outlet. */
export function AdminShell() {
    return (
        <AdminAuthGate>
            <AdminLayout />
        </AdminAuthGate>
    )
}
