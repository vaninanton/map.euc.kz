import { useMemo } from 'react'
import type { FeatureCollection } from '@/types/geojson'
import { getActiveRiders } from '@/utils/telegramRiders'

interface LiveActivityBarProps {
    telegramLatestGeo: FeatureCollection | null
    onPress: () => void
}

/**
 * Live Activity-индикатор вверху карты: показывает количество активных райдеров.
 * Скрывается, если никто не делится геопозицией.
 */
export function LiveActivityBar({ telegramLatestGeo, onPress }: LiveActivityBarProps) {
    const count = useMemo(() => getActiveRiders(telegramLatestGeo).length, [telegramLatestGeo])

    if (count === 0) return null

    const label = `Катают: ${String(count)}`

    return (
        <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <button
                type="button"
                onClick={onPress}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm backdrop-blur-sm cursor-pointer select-none"
                aria-label={label}
            >
                <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inset-0 rounded-full bg-green-500 animate-live-ping" />
                    <span className="relative inline-block h-2 w-2 rounded-full bg-green-500" />
                </span>
                {label}
            </button>
        </div>
    )
}
