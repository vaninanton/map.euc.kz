import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMapPin, faSearch, faXmark, faUsers, faPlug } from '@fortawesome/free-solid-svg-icons'
import type { FeatureCollection, PointFeature } from '@/types/geojson'
import { filterPoints } from '@/utils/pointFilters'
import type { PointFilterOptions } from '@/utils/pointFilters'
import type { HashFeatureType } from '@/utils/hashNav'

interface PointListSidebarProps {
    isOpen: boolean
    onClose: () => void
    pointsGeo: FeatureCollection | null
    syncSelectionUrl: (type: HashFeatureType, id: string) => void
    selectedPointId?: string
    isDesktop: boolean
}

export function PointListSidebar({
    isOpen,
    onClose,
    pointsGeo,
    syncSelectionUrl,
    selectedPointId,
    isDesktop,
}: PointListSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState<PointFilterOptions['typeFilter']>('all')
    const [onlyMeeting, setOnlyMeeting] = useState(false)
    const [onlySocket, setOnlySocket] = useState(false)
    const [onlyErlan, setOnlyErlan] = useState(false)

    // Precompute / extract points
    const points = useMemo<PointFeature[]>(() => {
        if (!pointsGeo) return []
        return pointsGeo.features.filter(
            (f): f is PointFeature => f.properties.type === 'point' || f.properties.type === 'socket'
        )
    }, [pointsGeo])

    // Filter points
    const filteredPoints = useMemo(() => {
        return filterPoints(points, {
            searchQuery,
            typeFilter,
            onlyMeeting,
            onlySocket,
            onlyErlan,
        })
    }, [points, searchQuery, typeFilter, onlyMeeting, onlySocket, onlyErlan])

    if (!isOpen) return null

    return (
        <aside
            className="fixed z-20 flex flex-col bg-white/95 backdrop-blur-md shadow-2xl border-neutral-200/80 overflow-hidden
                bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl border-t
                pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]
                pb-[max(0px,env(safe-area-inset-bottom))]
                md:bottom-0 md:top-0 md:left-0 md:right-auto md:max-h-none md:w-[360px] md:max-w-[90vw] md:rounded-none md:rounded-r-2xl md:border-t-0 md:border-r md:control-inset-left md:control-inset-top md:control-inset-bottom"
            role="dialog"
            aria-label="Список точек"
        >
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200/80 bg-neutral-50/90">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faMapPin} className="text-[#3b82f6]" aria-hidden />
                    <span className="text-sm font-semibold text-neutral-800 uppercase tracking-wider">
                        Точки ({filteredPoints.length})
                    </span>
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

            {/* Controls */}
            <div className="shrink-0 p-4 border-b border-neutral-200/60 space-y-4 bg-white/50">
                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value) }}
                        placeholder="Поиск точки..."
                        className="w-full pl-9 pr-8 py-1.5 text-sm bg-neutral-100/80 focus:bg-white border border-neutral-200 focus:border-blue-300 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-100 transition-all placeholder-neutral-400 text-neutral-800"
                    />
                    <FontAwesomeIcon
                        icon={faSearch}
                        className="absolute left-3 top-2.5 text-neutral-400 text-xs pointer-events-none"
                        aria-hidden
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => { setSearchQuery('') }}
                            className="absolute right-2.5 top-2 p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-200/50 cursor-pointer"
                            aria-label="Очистить поиск"
                        >
                            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden />
                        </button>
                    )}
                </div>

                {/* Type Filters */}
                <div className="space-y-1.5">
                    <span className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Тип объекта
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {([
                            ['all', 'Все'],
                            ['point', 'Обычные точки'],
                            ['socket', 'Публичные розетки'],
                        ] as const).map(([val, label]) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => { setTypeFilter(val) }}
                                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                                    typeFilter === val
                                        ? 'bg-gradient-to-r from-blue-500 to-[#3b82f6] text-white shadow-xs'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Additional Toggles */}
                <div className="space-y-2 pt-1">
                    <label className="flex items-center justify-between gap-3 text-xs text-neutral-700 cursor-pointer">
                        <span className="font-medium text-neutral-600">Только места встреч</span>
                        <span className="relative inline-flex h-5 w-9 items-center">
                            <input
                                type="checkbox"
                                checked={onlyMeeting}
                                onChange={(e) => { setOnlyMeeting(e.target.checked) }}
                                className="peer sr-only"
                            />
                            <span
                                className={`absolute inset-0 rounded-full bg-neutral-200 transition-colors peer-checked:bg-blue-500`}
                                aria-hidden
                            />
                            <span
                                className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
                                aria-hidden
                            />
                        </span>
                    </label>

                    <label className="flex items-center justify-between gap-3 text-xs text-neutral-700 cursor-pointer">
                        <span className="font-medium text-neutral-600">С розеткой для подзарядки</span>
                        <span className="relative inline-flex h-5 w-9 items-center">
                            <input
                                type="checkbox"
                                checked={onlySocket}
                                onChange={(e) => { setOnlySocket(e.target.checked) }}
                                className="peer sr-only"
                            />
                            <span
                                className={`absolute inset-0 rounded-full bg-neutral-200 transition-colors peer-checked:bg-green-500`}
                                aria-hidden
                            />
                            <span
                                className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
                                aria-hidden
                            />
                        </span>
                    </label>

                    <label className="flex items-center justify-between gap-3 text-xs text-neutral-700 cursor-pointer">
                        <span className="font-medium text-neutral-600">Показывать только Ерландию</span>
                        <span className="relative inline-flex h-5 w-9 items-center">
                            <input
                                type="checkbox"
                                checked={onlyErlan}
                                onChange={(e) => { setOnlyErlan(e.target.checked) }}
                                className="peer sr-only"
                            />
                            <span
                                className={`absolute inset-0 rounded-full bg-neutral-200 transition-colors peer-checked:bg-purple-500`}
                                aria-hidden
                            />
                            <span
                                className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
                                aria-hidden
                            />
                        </span>
                    </label>
                </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto min-h-0 flex-1 p-3 space-y-2.5 bg-neutral-50/50">
                {filteredPoints.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-400 font-medium">
                        Точки не найдены
                    </div>
                ) : (
                    filteredPoints.map((feature) => {
                        const id = feature.properties.id
                        const isActive = id === selectedPointId
                        const props = feature.properties
                        const isMeeting = props.type === 'point' && props.isMeeting
                        const hasSocket = props.type === 'socket' || (props.type === 'point' && props.hasSocket)

                        const handleClick = () => {
                            syncSelectionUrl('point', id)
                            if (!isDesktop) {
                                onClose()
                            }
                        }

                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={handleClick}
                                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ease-in-out cursor-pointer hover:-translate-y-0.5 hover:shadow-xs ${
                                    isActive
                                        ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                                        : 'bg-white border-neutral-200/60 hover:bg-blue-50/30 hover:border-blue-200/40'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-semibold text-neutral-800 text-xs sm:text-sm line-clamp-1">
                                        {props.name || 'Без названия'}
                                    </h4>
                                    <div className="flex gap-1">
                                        {props.type === 'socket' && (
                                            <span className="shrink-0 inline-flex items-center rounded-md bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 border border-green-200">
                                                Розетка
                                            </span>
                                        )}
                                        {props.isErlan && (
                                            <span className="shrink-0 inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700 border border-purple-200">
                                                Ерландия
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {props.description && (
                                    <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">
                                        {props.description}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2.5 mt-2.5 text-[10px] font-medium text-neutral-400">
                                    {isMeeting && (
                                        <span className="inline-flex items-center gap-1 text-blue-600">
                                            <FontAwesomeIcon icon={faUsers} className="text-[9px]" aria-hidden />
                                            Место встречи
                                        </span>
                                    )}
                                    {hasSocket && props.type !== 'socket' && (
                                        <span className="inline-flex items-center gap-1 text-green-600">
                                            <FontAwesomeIcon icon={faPlug} className="text-[9px]" aria-hidden />
                                            Есть розетка
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </aside>
    )
}
