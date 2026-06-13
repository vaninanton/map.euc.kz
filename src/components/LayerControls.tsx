import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSliders } from '@fortawesome/free-solid-svg-icons'
import type { LayerKey, LayerVisibility } from '@/hooks/useLayers'
import type { BaseMapStyle } from '@/hooks/useMapbox'
import { LayerPanel } from '@/components/LayerPanel'

interface LayerControlsProps {
    visibility: LayerVisibility
    onToggle: (layer: LayerKey) => void
    baseStyle: BaseMapStyle
    onToggleBaseStyle: () => void
}

/**
 * Кнопка + панель фильтров слоёв карты.
 *
 * Позиция задаётся через CSS (index.css .layer-controls-root) без JS-вычислений.
 * Динамическое позиционирование (MutationObserver + getBoundingClientRect) вызывало
 * прыжок кнопки геолокации: панель открывается с CSS-анимацией (transform) →
 * браузер пересчитывает layout → Mapbox ResizeObserver на контейнере карты
 * срабатывает → map.resize() → все контролы смещаются.
 *
 * Реальные значения из mapbox-gl.css:
 *   - кнопка: 32×32px
 *   - margin для bottom-right: 0 10px 10px 0
 */
export function LayerControls({
    visibility,
    onToggle,
    baseStyle,
    onToggleBaseStyle,
}: LayerControlsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isClosing, setIsClosing] = useState(false)
    const [mounted, setMounted] = useState(false)

    // Ждём монтирования, чтобы createPortal не кидал ошибку при SSR
    useEffect(() => { setMounted(true) }, [])

    const handleClose = useCallback(() => { setIsClosing(true) }, [])

    const handleToggle = useCallback(() => {
        if (isOpen && !isClosing) {
            handleClose()
        } else if (!isOpen) {
            setIsOpen(true)
            setIsClosing(false)
        }
    }, [isOpen, isClosing, handleClose])

    const handleAnimationEnd = useCallback(() => {
        if (isClosing) {
            setIsOpen(false)
            setIsClosing(false)
        }
    }, [isClosing])

    if (!mounted) return null

    return createPortal(
        <div className="layer-controls-root">
            {isOpen && (
                <div
                    className={`layer-panel-popup${isClosing ? ' layer-panel-popup--closing' : ''}`}
                    onAnimationEnd={handleAnimationEnd}
                >
                    <LayerPanel
                        visibility={visibility}
                        onToggle={onToggle}
                        onCollapse={handleClose}
                        baseStyle={baseStyle}
                        onToggleBaseStyle={onToggleBaseStyle}
                    />
                </div>
            )}
            <div className="layer-controls-trigger">
                <button
                    type="button"
                    onClick={handleToggle}
                    aria-label={isOpen ? 'Закрыть панель слоёв' : 'Фильтры слоёв'}
                    title={isOpen ? 'Закрыть панель слоёв' : 'Фильтры слоёв'}
                    aria-expanded={isOpen}
                    className={`layer-controls-btn${isOpen ? ' layer-controls-btn--active' : ''}`}
                >
                    <FontAwesomeIcon icon={faSliders} aria-hidden />
                </button>
            </div>
        </div>,
        document.body,
    )
}
