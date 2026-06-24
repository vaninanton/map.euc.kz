import { useCallback, useEffect, useRef, useState } from 'react'
import { buildEventShareLink, buildTelegramEventMessage, buildTelegramShareLink, copyOrShare } from '@/utils/shareLinks'
import { trackGoal } from '@/lib/analytics'
import { IconTelegram } from '@/components/icons/IconTelegram'
import { IconShare } from '@/components/icons/IconShare'
import type { EventRow } from '@/types'

interface EventShareBlockProps {
    event: EventRow
}

const TOAST_DURATION_MS = 2500

/** Блок шаринга события (как у точки/маршрута): Telegram + копирование ссылки. */
export function EventShareBlock({ event }: EventShareBlockProps) {
    const appUrl = buildEventShareLink(event.id)
    const telegramShareLink = buildTelegramShareLink(appUrl, buildTelegramEventMessage(event.title))
    const [showCopied, setShowCopied] = useState(false)
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleAppShare = useCallback(async () => {
        const ok = await copyOrShare(appUrl, event.title)
        if (ok) {
            trackGoal('share_app_link', { featureType: 'event' })
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
            setShowCopied(true)
            toastTimeoutRef.current = setTimeout(() => {
                setShowCopied(false)
            }, TOAST_DURATION_MS)
        }
    }, [appUrl, event.title])

    useEffect(
        () => () => {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
        },
        [],
    )

    return (
        <div className="mt-3 border-t border-neutral-200 px-2 pt-3 pb-4">
            <div className="flex flex-wrap gap-2">
                <a
                    href={telegramShareLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                        trackGoal('share_telegram', { featureType: 'event' })
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-sky-50 hover:text-sky-600"
                    title="Поделиться в Telegram"
                    aria-label="Поделиться в Telegram"
                >
                    <IconTelegram />
                </a>
                <button
                    type="button"
                    onClick={() => {
                        void handleAppShare()
                    }}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-800"
                    title="Копировать ссылку"
                    aria-label="Копировать ссылку"
                >
                    <IconShare />
                </button>
            </div>
            {showCopied && (
                <div
                    className="fixed inset-x-0 z-50 bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1.5rem))] flex justify-center px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pointer-events-none"
                    role="status"
                    aria-live="polite"
                >
                    <div className="pointer-events-auto rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
                        Ссылка скопирована
                    </div>
                </div>
            )}
        </div>
    )
}
