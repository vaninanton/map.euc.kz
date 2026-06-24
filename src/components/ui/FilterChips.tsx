interface FilterChipsProps<T extends string> {
    /** Заголовок группы фильтров (uppercase-подпись). */
    label?: string
    options: readonly (readonly [T, string])[]
    value: T
    onChange: (value: T) => void
    /** Класс активного чипа, напр. `bg-gradient-to-r from-blue-500 to-[#3b82f6] text-white shadow-xs`. */
    activeClass: string
}

/** Группа чипов-фильтров с одиночным выбором. Общий примитив для сайдбаров-списков. */
export function FilterChips<T extends string>({ label, options, value, onChange, activeClass }: FilterChipsProps<T>) {
    return (
        <div className="space-y-1.5">
            {label && (
                <span className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    {label}
                </span>
            )}
            <div className="flex flex-wrap gap-1">
                {options.map(([val, optionLabel]) => (
                    <button
                        key={val}
                        type="button"
                        onClick={() => {
                            onChange(val)
                        }}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                            value === val ? activeClass : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
                        }`}
                    >
                        {optionLabel}
                    </button>
                ))}
            </div>
        </div>
    )
}
