import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMapPin, faUsers, faPlug } from '@fortawesome/free-solid-svg-icons'
import type { FeatureCollection, PointFeature } from '@/types/geojson'
import { filterPoints } from '@/utils/pointFilters'
import type { PointFilterOptions } from '@/utils/pointFilters'
import type { HashFeatureType } from '@/utils/hashNav'
import { UI_ACCENT } from '@/constants'
import { ListSidebarShell } from '@/components/ListSidebarShell'
import { SearchInput } from '@/components/ui/SearchInput'
import { FilterChips } from '@/components/ui/FilterChips'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Badge } from '@/components/ui/Badge'

interface PointListSidebarProps {
    isOpen: boolean
    onClose: () => void
    pointsGeo: FeatureCollection | null
    syncSelectionUrl: (type: HashFeatureType, id: string) => void
    selectedPointId?: string
    isDesktop: boolean
}

const TYPE_OPTIONS = [
    ['all', 'Все'],
    ['point', 'Обычные точки'],
    ['socket', 'Публичные розетки'],
] as const

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
            (f): f is PointFeature => f.properties.type === 'point' || f.properties.type === 'socket',
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

    return (
        <ListSidebarShell
            isOpen={isOpen}
            onClose={onClose}
            icon={faMapPin}
            iconColor={UI_ACCENT.point}
            title={`Точки (${String(filteredPoints.length)})`}
            ariaLabel="Список точек"
            controls={
                <>
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Поиск точки..."
                        accentClass="focus:border-blue-300 focus:ring-blue-100"
                    />

                    <FilterChips
                        label="Тип объекта"
                        options={TYPE_OPTIONS}
                        value={typeFilter}
                        onChange={setTypeFilter}
                        activeClass="bg-gradient-to-r from-blue-500 to-[#2563eb] text-white shadow-xs"
                    />

                    <div className="space-y-2 pt-1">
                        <ToggleSwitch
                            checked={onlyMeeting}
                            onChange={setOnlyMeeting}
                            label="Только места встреч"
                            accentColor={UI_ACCENT.meeting}
                        />
                        <ToggleSwitch
                            checked={onlySocket}
                            onChange={setOnlySocket}
                            label="С розеткой для подзарядки"
                            accentColor={UI_ACCENT.socket}
                        />
                        <ToggleSwitch
                            checked={onlyErlan}
                            onChange={setOnlyErlan}
                            label="Показывать только Ерландию"
                            accentColor={UI_ACCENT.erlan}
                        />
                    </div>
                </>
            }
        >
            {filteredPoints.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400 font-medium">Точки не найдены</div>
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
                                    {props.type === 'socket' && <Badge color="socket">Розетка</Badge>}
                                    {props.isErlan && <Badge color="erlan">Ерландия</Badge>}
                                </div>
                            </div>

                            {props.description && (
                                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">{props.description}</p>
                            )}

                            <div className="flex flex-wrap gap-2.5 mt-2.5 text-[10px] font-medium text-neutral-400">
                                {isMeeting && (
                                    <span className="inline-flex items-center gap-1 text-blue-600">
                                        <FontAwesomeIcon icon={faUsers} className="text-[9px]" aria-hidden />
                                        Место встречи
                                    </span>
                                )}
                                {hasSocket && props.type !== 'socket' && (
                                    <span className="inline-flex items-center gap-1 text-amber-600">
                                        <FontAwesomeIcon icon={faPlug} className="text-[9px]" aria-hidden />
                                        Есть розетка
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
