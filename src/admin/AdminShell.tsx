import { AdminAuthGate } from '@/admin/AdminAuthGate'
import { AdminLayout } from '@/admin/AdminLayout'
import { usePasswordRecovery } from '@/admin/hooks/usePasswordRecovery'

/** Обёртка для вложенных маршрутов `/admin/*`: Auth → Layout с Outlet. */
export function AdminShell() {
    usePasswordRecovery()

    return (
        <AdminAuthGate>
            <AdminLayout />
        </AdminAuthGate>
    )
}
