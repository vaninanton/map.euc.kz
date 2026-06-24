import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faXmark } from '@fortawesome/free-solid-svg-icons'

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    /** Классы фокус-акцента, напр. `focus:border-blue-300 focus:ring-blue-100`. */
    accentClass?: string
}

/** Поле поиска с иконкой и кнопкой очистки. Общий примитив для сайдбаров-списков. */
export function SearchInput({
    value,
    onChange,
    placeholder = 'Поиск...',
    accentClass = 'focus:border-blue-300 focus:ring-blue-100',
}: SearchInputProps) {
    return (
        <div className="relative">
            <input
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value)
                }}
                placeholder={placeholder}
                className={`w-full pl-9 pr-8 py-1.5 text-sm bg-neutral-100/80 focus:bg-white border border-neutral-200 rounded-xl outline-hidden focus:ring-2 transition-all placeholder-neutral-400 text-neutral-800 ${accentClass}`}
            />
            <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-2.5 text-neutral-400 text-xs pointer-events-none"
                aria-hidden
            />
            {value && (
                <button
                    type="button"
                    onClick={() => {
                        onChange('')
                    }}
                    className="absolute right-2.5 top-2 p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-200/50 cursor-pointer"
                    aria-label="Очистить поиск"
                >
                    <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden />
                </button>
            )}
        </div>
    )
}
