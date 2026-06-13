import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faMapPin, faRoute, faLocationCrosshairs, faPlus, faXmark, faQuestion } from '@fortawesome/free-solid-svg-icons'

interface BottomTabBarProps {
    isPointListOpen: boolean
    onTogglePointList: () => void
    isRouteListOpen: boolean
    onToggleRouteList: () => void
    isRadarOpen: boolean
    onToggleRadar: () => void
    isAddingPoint: boolean
    onToggleAddPoint: () => void
    onOpenProjectInfo: () => void
}

interface TabItem {
    key: string
    label: string
    icon: IconDefinition
    active: boolean
    onClick: () => void
}

/**
 * Нижний таб-бар карты: основные действия (точки, маршруты, радар, добавление точки, помощь).
 * Занимает нижнюю safe-area-зону — в standalone-PWA на iOS она иначе остаётся пустой полосой,
 * т.к. вьюпорт вебвью короче экрана и карта туда не дотягивается.
 */
export function BottomTabBar({
    isPointListOpen,
    onTogglePointList,
    isRouteListOpen,
    onToggleRouteList,
    isRadarOpen,
    onToggleRadar,
    isAddingPoint,
    onToggleAddPoint,
    onOpenProjectInfo,
}: BottomTabBarProps) {
    const items: TabItem[] = [
        { key: 'points', label: 'Точки', icon: faMapPin, active: isPointListOpen, onClick: onTogglePointList },
        { key: 'routes', label: 'Маршруты', icon: faRoute, active: isRouteListOpen, onClick: onToggleRouteList },
        {
            key: 'add',
            label: isAddingPoint ? 'Отмена' : 'Добавить',
            icon: isAddingPoint ? faXmark : faPlus,
            active: isAddingPoint,
            onClick: onToggleAddPoint,
        },
        { key: 'radar', label: 'Радар', icon: faLocationCrosshairs, active: isRadarOpen, onClick: onToggleRadar },
        { key: 'info', label: 'Помощь', icon: faQuestion, active: false, onClick: onOpenProjectInfo },
    ]

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-neutral-200 bg-white"
            // Небольшой нижний отступ, чтобы подписи не липли к краю вьюпорта. Полный
            // safe-area-inset-bottom не берём — он ниже вьюпорта и копит лишний белый
            // воздух; зону home-indicator закрывает белый фон :root, сливаясь с меню.
            style={{
                paddingBottom: '0.5rem',
                paddingLeft: 'env(safe-area-inset-left)',
                paddingRight: 'env(safe-area-inset-right)',
            }}
            aria-label="Основная навигация"
        >
            {items.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    aria-label={item.label}
                    aria-pressed={item.active}
                    className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                        item.active ? 'text-[#f25824]' : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                >
                    <FontAwesomeIcon icon={item.icon} className="text-lg" aria-hidden />
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    )
}
