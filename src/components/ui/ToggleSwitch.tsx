import type { ReactNode } from 'react'

interface ToggleSwitchProps {
    checked: boolean
    onChange: (checked: boolean) => void
    /** Подпись слева от переключателя. Если не задана — рендерится только сам переключатель. */
    label?: ReactNode
    /** CSS-цвет включённого трека (любое валидное значение color). */
    accentColor: string
    /** id для связи внешнего <label htmlFor>; иначе переключатель оборачивается в <label>. */
    id?: string
    /** Доступное имя, если подписи нет. */
    ariaLabel?: string
}

/**
 * Переключатель-тумблер (track + бегунок) на скрытом чекбоксе.
 * Объединяет повторяющуюся разметку `peer sr-only` из сайдбаров и панели слоёв.
 * Цвет включённого состояния задаётся CSS-значением через `accentColor`.
 */
export function ToggleSwitch({ checked, onChange, label, accentColor, id, ariaLabel }: ToggleSwitchProps) {
    const control = (
        <span className="relative inline-flex h-5 w-9 items-center">
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                    onChange(e.target.checked)
                }}
                className="peer sr-only"
                aria-label={label ? undefined : ariaLabel}
            />
            <span
                className="absolute inset-0 rounded-full bg-neutral-200 transition-colors"
                style={checked ? { backgroundColor: accentColor } : undefined}
                aria-hidden
            />
            <span
                className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
                aria-hidden
            />
        </span>
    )

    if (label === undefined) return control

    return (
        <label htmlFor={id} className="flex items-center justify-between gap-3 text-xs text-neutral-700 cursor-pointer">
            <span className="font-medium text-neutral-600">{label}</span>
            {control}
        </label>
    )
}
