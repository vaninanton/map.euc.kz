import type { ReactNode } from 'react'

/** Базовый класс квадратной share-кнопки (40×40, нейтральный фон). */
const BASE_CLASS =
    'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors'

interface ShareLinkProps {
    href: string
    /** Доп. классы для hover-акцента (например, `hover:bg-sky-50 hover:text-sky-600`). */
    accentClass?: string
    title: string
    ariaLabel?: string
    /** Открывать ли во внешней вкладке (target=_blank + rel). */
    external?: boolean
    onClick?: () => void
    children: ReactNode
}

/** Квадратная share-ссылка с общим стилем. */
export function ShareLink({ href, accentClass = '', title, ariaLabel, external, onClick, children }: ShareLinkProps) {
    return (
        <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            onClick={onClick}
            className={`${BASE_CLASS} ${accentClass}`}
            title={title}
            aria-label={ariaLabel}
        >
            {children}
        </a>
    )
}
