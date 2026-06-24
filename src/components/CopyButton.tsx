import type { ReactNode } from 'react'

interface CopyButtonProps {
    onClick: () => void
    /** Показывать ли подтверждающий tooltip над кнопкой (после копирования). */
    copied: boolean
    /** Подпись hover-tooltip над кнопкой. */
    label?: string
    /** Доступное имя кнопки (по умолчанию совпадает с label). */
    ariaLabel?: string
    /** Текст tooltip-подтверждения после копирования. */
    copiedLabel?: string
    children: ReactNode
}

/** Класс tooltip над кнопкой (общий для hover-подсказки и подтверждения). */
const TOOLTIP_CLASS =
    'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg'

/**
 * Кнопка копирования ссылки с tooltip над собой:
 * — при наведении показывает подсказку `label` («Скопировать ссылку»);
 * — после копирования (`copied`) показывает подтверждение `copiedLabel`, которое
 *   приоритетнее hover-подсказки. Tooltip заметнее нижнего тоста — он у самой кнопки.
 */
export function CopyButton({
    onClick,
    copied,
    label = 'Скопировать ссылку',
    ariaLabel = label,
    copiedLabel = 'Скопировано',
    children,
}: CopyButtonProps) {
    return (
        <span className="group relative inline-flex">
            <button
                type="button"
                onClick={onClick}
                aria-label={ariaLabel}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-800"
            >
                {children}
            </button>

            <span
                className={`${TOOLTIP_CLASS} ${
                    copied ? 'animate-tooltip-in' : 'opacity-0 transition-opacity group-hover:opacity-100'
                }`}
                {...(copied ? { role: 'status', 'aria-live': 'polite' } : { 'aria-hidden': true })}
            >
                {copied ? copiedLabel : label}
                <span
                    className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-neutral-800"
                    aria-hidden
                />
            </span>
        </span>
    )
}
