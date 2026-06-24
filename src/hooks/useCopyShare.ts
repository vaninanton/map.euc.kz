import { useCallback, useEffect, useRef, useState } from 'react'
import { copyToClipboard } from '@/utils/shareLinks'
import { trackGoal } from '@/lib/analytics'

const TOAST_DURATION_MS = 2500

interface UseCopyShareResult {
    /** Показывать ли подтверждение «Скопировано» (tooltip у кнопки). */
    showCopied: boolean
    /** Копирует ссылку в буфер, шлёт цель и на успехе показывает подтверждение. */
    handleShare: () => Promise<void>
}

/**
 * Копирование ссылки приложения в буфер обмена с подтверждением «Скопировано».
 * Объединяет общую логику ShareBlock и EventShareBlock: copyToClipboard → цель
 * `share_app_link` → показ подтверждения на TOAST_DURATION_MS. Таймер чистится при размонтировании.
 *
 * @param url ссылка для копирования
 * @param featureType тип фичи для параметра цели Метрики
 * @param onCopied необязательный колбэк после успешного копирования
 */
export function useCopyShare(url: string, featureType: string, onCopied?: () => void): UseCopyShareResult {
    const [showCopied, setShowCopied] = useState(false)
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleShare = useCallback(async () => {
        const ok = await copyToClipboard(url)
        if (ok) {
            trackGoal('share_app_link', { featureType })
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
            setShowCopied(true)
            toastTimeoutRef.current = setTimeout(() => {
                setShowCopied(false)
            }, TOAST_DURATION_MS)
            onCopied?.()
        }
    }, [url, featureType, onCopied])

    useEffect(
        () => () => {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
        },
        [],
    )

    return { showCopied, handleShare }
}
