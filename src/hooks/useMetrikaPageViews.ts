import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isAdminPath, trackPageView } from '@/lib/analytics'

/**
 * Отправляет в Метрику виртуальный просмотр (`hit`) на каждое изменение пути SPA.
 * Первый рендер пропускается — стартовый просмотр Метрика фиксирует сама при init.
 * Маршруты админки (`/admin/*`) не трекаются.
 */
export function useMetrikaPageViews(): void {
    const location = useLocation()
    const url = `${location.pathname}${location.search}${location.hash}`
    const isFirstRender = useRef(true)

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        if (isAdminPath(location.pathname)) return
        trackPageView(url)
    }, [url, location.pathname])
}
