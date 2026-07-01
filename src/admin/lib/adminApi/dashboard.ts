import type { AdminDashboardStats } from '@/admin/lib/adminApi/types'
import { db, runOneParsed } from '@/admin/lib/adminApi/query'
import { parseAdminDashboardStats } from '@/admin/lib/adminApi/parsers'

/**
 * Загружает агрегированную статистику дашборда одним вызовом RPC
 * `get_admin_dashboard_stats` (доступ проверяется на сервере по map_admin_users).
 */
export async function getDashboardStats(): Promise<AdminDashboardStats> {
    return runOneParsed('getDashboardStats', db().rpc('get_admin_dashboard_stats'), parseAdminDashboardStats)
}
