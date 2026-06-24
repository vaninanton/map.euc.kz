import type { ReactNode } from 'react'

type BadgeColor = 'socket' | 'erlan'

// Тинты бейджей под цвета COLORS (socket — жёлтый/amber, erlan — фиолетовый).
const COLOR_CLASS: Record<BadgeColor, string> = {
    socket: 'bg-amber-50 text-amber-700 border-amber-200',
    erlan: 'bg-purple-50 text-purple-700 border-purple-200',
}

interface BadgeProps {
    color: BadgeColor
    children: ReactNode
}

/** Маленький бейдж-метка (напр. «Розетка», «Ерландия») для карточек списков. */
export function Badge({ color, children }: BadgeProps) {
    return (
        <span
            className={`shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold border ${COLOR_CLASS[color]}`}
        >
            {children}
        </span>
    )
}
