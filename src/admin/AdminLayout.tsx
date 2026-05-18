import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
    { to: 'submissions', label: 'Заявки' },
    { to: 'point', label: 'Точки' },
    { to: 'route', label: 'Маршруты' },
    { to: 'geo', label: 'Гео' },
] as const

export function AdminLayout() {
    return (
        <div className="flex min-h-dvh bg-neutral-50 text-neutral-900">
            <aside className="flex w-56 flex-col border-r border-neutral-200 bg-white">
                <div className="px-4 py-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Админка</p>
                    <p className="mt-1 text-sm text-neutral-700">map.euc.kz</p>
                </div>
                <nav className="flex flex-col gap-1 px-2 pb-4">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                [
                                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                                    isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-neutral-700 hover:bg-neutral-100',
                                ].join(' ')
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="mt-auto flex flex-col gap-2 border-t border-neutral-200 px-4 py-3">
                    <Link to="/" className="text-xs text-neutral-500 hover:text-neutral-700">
                        ← Вернуться на карту
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            void supabase?.auth.signOut()
                        }}
                        className="text-left text-xs font-medium text-red-700 hover:text-red-900"
                    >
                        Выйти
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-x-auto px-6 py-6">
                <Suspense fallback={<div className="text-sm text-neutral-500">Загрузка…</div>}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    )
}
