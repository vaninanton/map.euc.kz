import { MetrikaCounter } from 'react-metrika'
import { useLocation } from 'react-router-dom'
import { isAdminPath, metrikaCounterId } from '@/lib/analytics'
import { useMetrikaPageViews } from '@/hooks/useMetrikaPageViews'

/**
 * Счётчик Метрики через пакет react-metrika.
 * Не рендерится без VITE_YANDEX_METRIKA_ID и в админ-зоне (`/admin/*`) —
 * чтобы не считать служебный трафик и не писать webvisor по админке.
 */
export function YandexMetrika() {
    // Хуки вызываем всегда (до раннего return) — иначе нарушим правила хуков.
    // trackPageView внутри сам no-op, если счётчик не подключён или путь — админский.
    useMetrikaPageViews()
    const { pathname } = useLocation()

    if (metrikaCounterId === null || isAdminPath(pathname)) {
        return null
    }

    return (
        <MetrikaCounter
            id={metrikaCounterId}
            options={{
                accurateTrackBounce: true,
                childIframe: false,
                clickmap: true,
                defer: false,
                ecommerce: false,
                params: {},
                userParams: {},
                trackHash: true,
                trackLinks: true,
                type: 0,
                webvisor: true,
                triggerEvent: false,
                sendTitle: true,
            }}
        />
    )
}
