import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { countPendingSubmissions } from '@/admin/lib/adminApi'

const NAV_ITEMS = [
    { to: '/admin', label: 'Дашборд', end: true },
    { to: '/admin/submissions', label: 'Заявки', end: false },
    { to: '/admin/point', label: 'Точки', end: false },
    { to: '/admin/route', label: 'Маршруты', end: false },
    { to: '/admin/event', label: 'События', end: false },
    { to: '/admin/news', label: 'Новости', end: false },
    { to: '/admin/telegram-chats', label: 'Telegram-чаты', end: false },
    { to: '/admin/geo', label: 'Гео', end: false },
] as const

export function AdminLayout() {
    const location = useLocation()
    const [pendingCount, setPendingCount] = useState<number | null>(null)

    // Бейдж pending-заявок; обновляется при переходах по разделам (после модерации счётчик актуализируется)
    useEffect(() => {
        let cancelled = false
        countPendingSubmissions()
            .then((count) => {
                if (!cancelled) setPendingCount(count)
            })
            .catch(() => {
                if (!cancelled) setPendingCount(null)
            })
        return () => {
            cancelled = true
        }
    }, [location.pathname])

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
                            end={item.end}
                            className={({ isActive }) =>
                                [
                                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition',
                                    isActive ? 'bg-blue-50 text-blue-700' : 'text-neutral-700 hover:bg-neutral-100',
                                ].join(' ')
                            }
                        >
                            <span>{item.label}</span>
                            {item.label === 'Заявки' && pendingCount !== null && pendingCount > 0 && (
                                <span
                                    className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white"
                                    aria-label={`Заявок на модерации: ${String(pendingCount)}`}
                                >
                                    {pendingCount}
                                </span>
                            )}
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
                        className="cursor-pointer text-left text-xs font-medium text-red-700 hover:text-red-900"
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
