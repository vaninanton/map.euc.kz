import { MetrikaCounter } from 'react-metrika'

const rawId = import.meta.env.VITE_YANDEX_METRIKA_ID?.trim()
const counterId =
    rawId && rawId.length > 0 ? Number.parseInt(rawId, 10) : Number.NaN

/** Счётчик Метрики через пакет react-metrika; без VITE_YANDEX_METRIKA_ID не рендерится. */
export function YandexMetrika() {
    if (!Number.isFinite(counterId) || counterId <= 0) {
        return null
    }

    return (
        <MetrikaCounter
            id={counterId}
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
