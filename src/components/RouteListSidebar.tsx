import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRoute, faMountain, faRoad } from '@fortawesome/free-solid-svg-icons'
import type { FeatureCollection, RouteFeature } from '@/types/geojson'
import { computeRouteStats } from '@/utils/routeStats'
import { filterRoutes } from '@/utils/routeFilters'
import type { RouteFilterOptions, RouteWithStats } from '@/utils/routeFilters'
import type { HashFeatureType } from '@/utils/hashNav'
import { UI_ACCENT } from '@/constants'
import { ListSidebarShell } from '@/components/ListSidebarShell'
import { SearchInput } from '@/components/ui/SearchInput'
import { FilterChips } from '@/components/ui/FilterChips'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Badge } from '@/components/ui/Badge'

interface RouteListSidebarProps {
    isOpen: boolean
    onClose: () => void
    routesGeo: FeatureCollection | null
    syncSelectionUrl: (type: HashFeatureType, id: string) => void
    selectedRouteId?: string
    isDesktop: boolean
}

const DISTANCE_OPTIONS = [
    ['all', 'Все'],
    ['under10', '< 10 км'],
    ['10to25', '10-25 км'],
    ['25to50', '25-50 км'],
    ['over50', '> 50 км'],
] as const

const ASCENT_OPTIONS = [
    ['all', 'Любой'],
    ['flat', 'Плоские (<100 м)'],
    ['hilly', 'Холмистые'],
    ['mountain', 'Горные (>500 м)'],
] as const

const ROUTE_CHIP_ACTIVE = 'bg-gradient-to-r from-orange-500 to-[#f25824] text-white shadow-xs'

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

    return (
        <ListSidebarShell
            isOpen={isOpen}
            onClose={onClose}
            icon={faRoute}
            iconColor={UI_ACCENT.route}
            title={`Маршруты (${String(filteredRoutes.length)})`}
            ariaLabel="Список маршрутов"
            controls={
                <>
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Поиск маршрута..."
                        accentClass="focus:border-orange-300 focus:ring-orange-100"
                    />

                    <FilterChips
                        label="Дистанция"
                        options={DISTANCE_OPTIONS}
                        value={distanceRange}
                        onChange={setDistanceRange}
                        activeClass={ROUTE_CHIP_ACTIVE}
                    />

                    <FilterChips
                        label="Набор высоты"
                        options={ASCENT_OPTIONS}
                        value={ascentRange}
                        onChange={setAscentRange}
                        activeClass={ROUTE_CHIP_ACTIVE}
                    />

                    <div className="pt-1">
                        <ToggleSwitch
                            checked={onlyErlan}
                            onChange={setOnlyErlan}
                            label="Показывать только Ерландию"
                            accentColor={UI_ACCENT.route}
                        />
                    </div>
                </>
            }
        >
            {filteredRoutes.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400 font-medium">Маршруты не найдены</div>
            ) : (
                filteredRoutes.map(({ feature, stats }) => {
                    const id = feature.properties.id
                    const isActive = id === selectedRouteId
                    const dist =
                        feature.properties.distance != null && Number.isFinite(feature.properties.distance)
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
                                {feature.properties.isErlan && <Badge color="erlan">Ерландия</Badge>}
                            </div>

                            {feature.properties.description && (
                                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">
                                    {feature.properties.description}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2.5 mt-2.5 text-[10px] font-medium text-neutral-400">
                                <span className="inline-flex items-center gap-1">
                                    <FontAwesomeIcon
                                        icon={faRoad}
                                        className="text-neutral-300 text-[9px]"
                                        aria-hidden
                                    />
                                    {dist.toFixed(1)} км
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <FontAwesomeIcon
                                        icon={faMountain}
                                        className="text-neutral-300 text-[9px]"
                                        aria-hidden
                                    />
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
        </ListSidebarShell>
    )
}
