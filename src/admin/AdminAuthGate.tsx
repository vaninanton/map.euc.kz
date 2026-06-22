import type { ReactNode } from 'react'
import { useAdminAuth } from '@/admin/hooks/useAdminAuth'
import { AdminLoginPage } from '@/admin/pages/AdminLoginPage'
import { supabase } from '@/lib/supabase'

interface AdminAuthGateProps {
    children: ReactNode
}

export function AdminAuthGate({ children }: AdminAuthGateProps) {
    const auth = useAdminAuth()

    if (auth.status === 'loading') {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-neutral-50 text-sm text-neutral-600">
                Загрузка…
            </div>
        )
    }

    if (auth.status === 'misconfigured') {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-neutral-50 p-4">
                <p className="max-w-md text-center text-red-700">{auth.message}</p>
            </div>
        )
    }

    if (auth.status === 'unauthenticated') {
        return <AdminLoginPage />
    }

    if (auth.status === 'forbidden') {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-50 p-6">
                <p className="max-w-md text-center text-neutral-800">
                    Вы вошли как <span className="font-medium">{auth.user.email || 'без email'}</span> (id:{' '}
                    <span className="font-medium">{auth.user.id}</span>), но у этого аккаунта нет прав администратора.
                    Добавьте <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">user_id</code> в таблицу{' '}
                    <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">map_admin_users</code> в Supabase SQL
                    Editor.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        void supabase?.auth.signOut()
                    }}
                    className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
                >
                    Выйти
                </button>
            </div>
        )
    }

    return <>{children}</>
}
