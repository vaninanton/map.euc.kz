import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRoute, faSearch, faXmark, faMountain, faRoad } from '@fortawesome/free-solid-svg-icons'
import type { FeatureCollection, RouteFeature } from '@/types/geojson'
import { computeRouteStats } from '@/utils/routeStats'
import { filterRoutes } from '@/utils/routeFilters'
import type { RouteFilterOptions, RouteWithStats } from '@/utils/routeFilters'
import type { HashFeatureType } from '@/utils/hashNav'

interface RouteListSidebarProps {
    isOpen: boolean
    onClose: () => void
    routesGeo: FeatureCollection | null
    syncSelectionUrl: (type: HashFeatureType, id: string) => void
    selectedRouteId?: string
    isDesktop: boolean
}

export function RouteListSidebar({
    isOpen,
    onClose,
    routesGeo,
    syncSelectionUrl,
    selectedRouteId,
    isDesktop,
}: RouteListSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [distanceRange, setDistanceRange] = useState<RouteFilterOptions['distanceRange']>('all')
    const [ascentRange, setAscentRange] = useState<RouteFilterOptions['ascentRange']>('all')
    const [onlyErlan, setOnlyErlan] = useState(false)

    // Precompute stats for all routes
    const routesWithStats = useMemo<RouteWithStats[]>(() => {
        if (!routesGeo) return []
        return routesGeo.features
            .filter((f): f is RouteFeature => f.properties.type === 'route')
            .map((feature) => {
                const stats = computeRouteStats(feature)
                return { feature, stats }
            })
    }, [routesGeo])

    // Filter routes based on search and filters
    const filteredRoutes = useMemo(() => {
        return filterRoutes(routesWithStats, {
            searchQuery,
            distanceRange,
            ascentRange,
            onlyErlan,
        })
    }, [routesWithStats, searchQuery, distanceRange, ascentRange, onlyErlan])

    if (!isOpen) return null

    return (
        <aside
            className="fixed z-20 flex flex-col bg-white/95 backdrop-blur-md shadow-2xl border-neutral-200/80 overflow-hidden
                bottom-0 left-0 right-0 h-[80vh] rounded-t-2xl border-t animate-slide-up
                pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]
                pb-[max(0px,env(safe-area-inset-bottom))]
                md:bottom-0 md:top-0 md:left-0 md:right-auto md:max-h-none md:w-[360px] md:max-w-[90vw] md:rounded-none md:rounded-r-2xl md:border-t-0 md:border-r md:control-inset-left md:control-inset-top md:control-inset-bottom md:animate-slide-in-left"
            role="dialog"
            aria-label="Список маршрутов"
        >
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200/80 bg-neutral-50/90">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faRoute} className="text-[#f25824]" aria-hidden />
                    <span className="text-sm font-semibold text-neutral-800 uppercase tracking-wider">
                        Маршруты ({filteredRoutes.length})
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
                        placeholder="Поиск маршрута..."
                        className="w-full pl-9 pr-8 py-1.5 text-sm bg-neutral-100/80 focus:bg-white border border-neutral-200 focus:border-orange-300 rounded-xl outline-hidden focus:ring-2 focus:ring-orange-100 transition-all placeholder-neutral-400 text-neutral-800"
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

                {/* Distance Filters */}
                <div className="space-y-1.5">
                    <span className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Дистанция
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {([
                            ['all', 'Все'],
                            ['under10', '< 10 км'],
                            ['10to25', '10-25 км'],
                            ['25to50', '25-50 км'],
                            ['over50', '> 50 км'],
                        ] as const).map(([val, label]) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => { setDistanceRange(val) }}
                                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                                    distanceRange === val
                                        ? 'bg-gradient-to-r from-orange-500 to-[#f25824] text-white shadow-xs'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ascent Filters */}
                <div className="space-y-1.5">
                    <span className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Набор высоты
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {([
                            ['all', 'Любой'],
                            ['flat', 'Плоские (<100 м)'],
                            ['hilly', 'Холмистые'],
                            ['mountain', 'Горные (>500 м)'],
                        ] as const).map(([val, label]) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => { setAscentRange(val) }}
                                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                                    ascentRange === val
                                        ? 'bg-gradient-to-r from-orange-500 to-[#f25824] text-white shadow-xs'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Erlandia Toggle */}
                <label className="flex items-center justify-between gap-3 text-xs text-neutral-700 cursor-pointer pt-1">
                    <span className="font-medium text-neutral-600">Показывать только Ерландию</span>
                    <span className="relative inline-flex h-5 w-9 items-center">
                        <input
                            type="checkbox"
                            checked={onlyErlan}
                            onChange={(e) => { setOnlyErlan(e.target.checked) }}
                            className="peer sr-only"
                        />
                        <span
                            className={`absolute inset-0 rounded-full bg-neutral-200 transition-colors peer-checked:bg-[#f25824]/90`}
                            aria-hidden
                        />
                        <span
                            className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
                            aria-hidden
                        />
                    </span>
                </label>
            </div>

            {/* List */}
            <div className="overflow-y-auto min-h-0 flex-1 p-3 space-y-2.5 bg-neutral-50/50">
                {filteredRoutes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-400 font-medium">
                        Маршруты не найдены
                    </div>
                ) : (
                    filteredRoutes.map(({ feature, stats }) => {
                        const id = feature.properties.id
                        const isActive = id === selectedRouteId
                        const dist = feature.properties.distance != null && Number.isFinite(feature.properties.distance)
                            ? feature.properties.distance
                            : stats.distanceKm

                        const handleClick = () => {
                            syncSelectionUrl('route', id)
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
                                        ? 'bg-orange-50/80 border-orange-300 shadow-xs'
                                        : 'bg-white border-neutral-200/60 hover:bg-orange-50/30 hover:border-orange-200/40'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-semibold text-neutral-800 text-xs sm:text-sm line-clamp-1">
                                        {feature.properties.name || 'Без названия'}
                                    </h4>
                                    {feature.properties.isErlan && (
                                        <span className="shrink-0 inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700 border border-purple-200">
                                            Ерландия
                                        </span>
                                    )}
                                </div>

                                {feature.properties.description && (
                                    <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">
                                        {feature.properties.description}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2.5 mt-2.5 text-[10px] font-medium text-neutral-400">
                                    <span className="inline-flex items-center gap-1">
                                        <FontAwesomeIcon icon={faRoad} className="text-neutral-300 text-[9px]" aria-hidden />
                                        {dist.toFixed(1)} км
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <FontAwesomeIcon icon={faMountain} className="text-neutral-300 text-[9px]" aria-hidden />
                                        ▲ {Math.round(stats.ascentM)} м
                                    </span>
                                    {stats.descentM > 0 && (
                                        <span className="inline-flex items-center gap-1">
                                            ▼ {Math.round(stats.descentM)} м
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
