import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

interface ListSidebarShellProps {
    isOpen: boolean
    onClose: () => void
    /** Иконка в шапке. */
    icon: IconDefinition
    /** Цвет иконки в шапке (CSS-цвет). */
    iconColor: string
    /** Заголовок с уже подставленным счётчиком, напр. «Точки (12)». */
    title: string
    /** aria-label для контейнера-диалога. */
    ariaLabel: string
    /** Блок фильтров/поиска под шапкой. */
    controls: ReactNode
    /** Содержимое списка (или пустое состояние). */
    children: ReactNode
}

/**
 * Каркас сайдбара-списка: мобильный bottom-sheet / desktop-левая панель,
 * шапка с иконкой, заголовком-счётчиком и кнопкой закрытия, слот фильтров и список.
 * Общий для PointListSidebar и RouteListSidebar.
 */
export function ListSidebarShell({
    isOpen,
    onClose,
    icon,
    iconColor,
    title,
    ariaLabel,
    controls,
    children,
}: ListSidebarShellProps) {
    if (!isOpen) return null

    return (
        <aside
            className="fixed z-20 flex flex-col bg-white/95 backdrop-blur-md shadow-2xl border-neutral-200/80 overflow-hidden
                bottom-0 left-0 right-0 h-[80vh] rounded-t-2xl border-t animate-slide-up
                pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]
                pb-[max(0px,env(safe-area-inset-bottom))]
                md:bottom-0 md:top-0 md:left-0 md:right-auto md:max-h-none md:w-[360px] md:max-w-[90vw] md:rounded-none md:rounded-r-2xl md:border-t-0 md:border-r md:control-inset-left md:control-inset-top md:control-inset-bottom md:animate-slide-in-left"
            role="dialog"
            aria-label={ariaLabel}
        >
            {/* Шапка */}
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200/80 bg-neutral-50/90">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={icon} style={{ color: iconColor }} aria-hidden />
                    <span className="text-sm font-semibold text-neutral-800 uppercase tracking-wider">{title}</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 -m-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors cursor-pointer"
                    aria-label="Закрыть"
                >
                    <FontAwesomeIcon icon={faXmark} className="h-5 w-5" aria-hidden />
                </button>
            </div>

            {/* Фильтры */}
            <div className="shrink-0 p-4 border-b border-neutral-200/60 space-y-4 bg-white/50">{controls}</div>

            {/* Список */}
            <div className="overflow-y-auto min-h-0 flex-1 p-3 space-y-2.5 bg-neutral-50/50">{children}</div>
        </aside>
    )
}
