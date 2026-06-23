import { ym } from 'react-metrika'

const rawId = import.meta.env.VITE_YANDEX_METRIKA_ID?.trim()
const parsedId = rawId && rawId.length > 0 ? Number.parseInt(rawId, 10) : Number.NaN

/** ID счётчика Метрики или null, если переменная не задана/некорректна. */
export const metrikaCounterId: number | null = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null

/** Подключена ли Метрика (есть валидный counter id). */
export const isMetrikaEnabled = metrikaCounterId !== null

/**
 * Путь относится к админ-панели (`/admin` и вложенные).
 * В админке Метрику не считаем: это служебная зона, не продуктовый трафик,
 * и сюда не должна попадать запись webvisor.
 */
export function isAdminPath(pathname: string): boolean {
    return pathname === '/admin' || pathname.startsWith('/admin/')
}

/**
 * Приложение запущено как установленная PWA (standalone).
 * Покрывает оба способа: стандартный `display-mode: standalone` (Chrome/Android/desktop)
 * и проприетарный `navigator.standalone` (iOS Safari, где нет события appinstalled).
 */
export function isStandaloneLaunch(): boolean {
    if (typeof window === 'undefined') return false
    const byMediaQuery = window.matchMedia('(display-mode: standalone)').matches
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    return byMediaQuery || iosStandalone
}

/** Допустимые цели (reachGoal). Держим список здесь — единый источник имён. */
export type MetrikaGoal =
    | 'feature_open' // открыта фича на карте (точка/маршрут/розетка/велодорожка/telegram)
    | 'share_app_link' // скопирована/расшарена ссылка на приложение
    | 'share_external_map' // переход во внешнюю карту/навигатор (Яндекс/2GIS/Guru/ORS)
    | 'share_telegram' // шаринг в Telegram
    | 'pwa_install' // приложение установлено как PWA (событие appinstalled)
    | 'pwa_launch_standalone' // запуск в standalone-режиме (установленная PWA, в т.ч. iOS)
    | 'geolocation_success' // пользователь успешно определил свою геопозицию
    | 'geolocation_denied' // доступ к геопозиции отклонён пользователем

/**
 * Регистрирует SPA-переход (виртуальный просмотр страницы).
 * No-op, если Метрика не подключена. Ошибки счётчика не пробрасываются.
 */
export function trackPageView(url: string): void {
    if (metrikaCounterId === null) return
    try {
        ym(metrikaCounterId, 'hit', url)
    } catch {
        // Метрика не должна влиять на работу приложения
    }
}

/**
 * Отправляет достижение цели в Метрику. No-op без подключённого счётчика.
 * Ошибки счётчика глушатся — аналитика не критична для UX.
 */
export function trackGoal(goal: MetrikaGoal, params?: Record<string, unknown>): void {
    if (metrikaCounterId === null) return
    try {
        ym(metrikaCounterId, 'reachGoal', goal, params)
    } catch {
        // Метрика не должна влиять на работу приложения
    }
}
