import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, TelegramUserProperties } from '@/types/geojson'
import { useUserGeolocation } from '@/hooks/useUserGeolocation'
import { useDeviceCompassHeading } from '@/hooks/useDeviceCompassHeading'
import {
    bearingDegrees,
    haversineKm,
    RADAR_MAX_DISTANCE_KM,
    RADAR_RING_KM_LOG,
    radarNormalizedRadiusLog,
    radarLinearScaleMax,
} from '@/utils/geoMath'
import { getTelegramGeoTtlMinutes } from '@/lib/env'

interface RadarModalProps {
    isOpen: boolean
    onClose: () => void
    telegramUsersGeo: FeatureCollection | null
    pointsGeo: FeatureCollection | null
    onSelectRider: (telegramUserId: number) => void
}

interface RadarRider {
    id: string
    telegramUserId: number
    name: string
    avatarUrl: string | null
    updatedAt: string
    ageMinutes: number
    distanceKm: number
    bearingDeg: number
    nearestPoint: { name: string; distanceKm: number } | null
}

const RADAR_SIZE = 320
const RADAR_CENTER = RADAR_SIZE / 2
const RADAR_INNER_PADDING = 24
const RADAR_RADIUS = RADAR_CENTER - RADAR_INNER_PADDING

function formatDistance(km: number): string {
    if (km < 1) {
        return `${String(Math.round(km * 1000))} м`
    }
    return `${km.toFixed(1)} км`
}

function formatAge(minutes: number): string {
    const rounded = Math.max(0, Math.round(minutes))
    if (rounded < 1) return 'только что'
    if (rounded < 60) return `${String(rounded)} мин назад`
    const hours = Math.floor(rounded / 60)
    const mins = rounded % 60
    if (mins === 0) return `${String(hours)} ч назад`
    return `${String(hours)} ч ${String(mins)} мин назад`
}

function getDisplayName(properties: TelegramUserProperties): string {
    if (properties.username) return `@${properties.username}`
    const fullName = [properties.firstName, properties.lastName].filter(Boolean).join(' ').trim()
    if (fullName) return fullName
    return `Пользователь ${String(properties.telegramUserId)}`
}

function getAvatar(properties: TelegramUserProperties): string | null {
    if (typeof properties.avatarUrl === 'string' && properties.avatarUrl.length > 0) {
        return properties.avatarUrl
    }
    return null
}

function getNearestPoint(
    lat: number,
    lon: number,
    pointsGeo: FeatureCollection | null,
): { name: string; distanceKm: number } | null {
    if (!pointsGeo) return null
    let best: { name: string; distanceKm: number } | null = null
    for (const f of pointsGeo.features) {
        if (f.geometry.type !== 'Point') continue
        if (f.properties.type !== 'point' && f.properties.type !== 'socket') continue
        const [flon, flat] = f.geometry.coordinates
        const d = haversineKm(lat, lon, flat, flon)
        if (best === null || d < best.distanceKm) best = { name: f.properties.name, distanceKm: d }
    }
    return best
}

function getRadarRiders(
    telegramUsersGeo: FeatureCollection | null,
    userLat: number,
    userLon: number,
    headingDeg: number,
    pointsGeo: FeatureCollection | null,
): RadarRider[] {
    if (!telegramUsersGeo) return []
    const ttlMinutes = getTelegramGeoTtlMinutes()
    const ttlMs = ttlMinutes * 60 * 1000
    const now = Date.now()
    const riders: RadarRider[] = []

    for (const feature of telegramUsersGeo.features) {
        if (feature.geometry.type !== 'Point') continue
        if (feature.properties.type !== 'telegramUser') continue
        const props = feature.properties
        const updatedTs = Date.parse(props.updatedAt)
        if (!Number.isFinite(updatedTs)) continue
        const ageMs = now - updatedTs
        if (ageMs > ttlMs) continue
        const [lon, lat] = feature.geometry.coordinates
        const distanceKm = haversineKm(userLat, userLon, lat, lon)
        const rawBearing = bearingDegrees(userLat, userLon, lat, lon)
        const bearingDeg = (rawBearing - headingDeg + 360) % 360
        riders.push({
            id: props.id,
            telegramUserId: props.telegramUserId,
            name: getDisplayName(props),
            avatarUrl: getAvatar(props),
            updatedAt: props.updatedAt,
            ageMinutes: ageMs / 60000,
            distanceKm,
            bearingDeg,
            nearestPoint: getNearestPoint(lat, lon, pointsGeo),
        })
    }

    riders.sort((a, b) => a.distanceKm - b.distanceKm)
    return riders
}

export function RadarModal({ isOpen, onClose, telegramUsersGeo, pointsGeo, onSelectRider }: RadarModalProps) {
    const { position, error, isSupported } = useUserGeolocation(isOpen)
    const { heading, compassEnabled, toggleCompass } = useDeviceCompassHeading(isOpen)
    const headingDeg = heading ?? 0
    const [scaleLog, setScaleLog] = useState(true)

    const riders = useMemo(() => {
        if (!position) return []
        return getRadarRiders(telegramUsersGeo, position.coords.latitude, position.coords.longitude, headingDeg, pointsGeo)
    }, [telegramUsersGeo, position, headingDeg, pointsGeo])

    const linearScaleMax = useMemo(() => {
        if (scaleLog || riders.length === 0) return 1
        return radarLinearScaleMax(Math.max(...riders.map((r) => r.distanceKm)))
    }, [scaleLog, riders])

    const normalizeRadius = useMemo(
        () =>
            scaleLog
                ? radarNormalizedRadiusLog
                : (km: number) => Math.min(Math.max(km, 0), linearScaleMax) / linearScaleMax,
        [scaleLog, linearScaleMax],
    )

    const ringKm = useMemo(
        () => (scaleLog ? (RADAR_RING_KM_LOG as readonly number[]) : [linearScaleMax / 2, linearScaleMax]),
        [scaleLog, linearScaleMax],
    )

    const [tick, setTick] = useState(0)
    useEffect(() => {
        if (!isOpen) return
        const id = setInterval(() => { setTick((t) => t + 1) }, 1000)
        return () => { clearInterval(id) }
    }, [isOpen])

    const orderedRiders = useMemo(() => {
        if (riders.length <= 1) return riders
        const OVERLAP_PX = 22
        const positions = riders.map((rider) => {
            const r = RADAR_RADIUS * normalizeRadius(rider.distanceKm)
            const rad = (rider.bearingDeg * Math.PI) / 180
            return { x: RADAR_CENTER + r * Math.sin(rad), y: RADAR_CENTER - r * Math.cos(rad) }
        })
        const groupOf = new Array<number>(riders.length).fill(-1)
        const groups: number[][] = []
        for (let i = 0; i < riders.length; i++) {
            if (groupOf[i] >= 0) continue
            const group = [i]
            groupOf[i] = groups.length
            for (let j = i + 1; j < riders.length; j++) {
                if (groupOf[j] >= 0) continue
                if (group.some((k) => {
                    const dx = positions[k].x - positions[j].x
                    const dy = positions[k].y - positions[j].y
                    return dx * dx + dy * dy < OVERLAP_PX * OVERLAP_PX
                })) {
                    group.push(j)
                    groupOf[j] = groups.length
                }
            }
            groups.push(group)
        }
        const result: RadarRider[] = []
        for (const group of groups) {
            if (group.length === 1) {
                result.push(riders[group[0]])
            } else {
                const activeIdx = tick % group.length
                for (let i = 0; i < group.length; i++) {
                    if (i !== activeIdx) result.push(riders[group[i]])
                }
                result.push(riders[group[activeIdx]])
            }
        }
        return result
    }, [riders, tick, normalizeRadius])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-black">
            <div className="h-full w-full flex flex-col safe-area-padding sm:p-3 md:p-4">
                <div className="mx-auto flex h-full w-full max-w-3xl flex-col border border-green-900/60 bg-black p-3 sm:p-4 overflow-hidden">

                    <div className="mb-2 shrink-0 flex items-center justify-between gap-3">
                        <h2 className="font-mono text-sm font-bold text-green-400 tracking-widest uppercase">[РАДАР]</h2>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => { setScaleLog((v) => !v) }}
                                className="inline-flex h-7 items-center gap-1 border border-green-900 bg-black px-2 text-xs font-mono text-green-700 transition hover:border-green-700 hover:text-green-400 cursor-pointer"
                                aria-label={scaleLog ? 'Переключить на линейную шкалу' : 'Переключить на логарифмическую шкалу'}
                                title={scaleLog ? 'Шкала: лог → линейная' : 'Шкала: линейная → лог'}
                            >
                                {scaleLog ? 'ЛОГАРИФМИЧНО' : 'АРИФМЕТИЧНО'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { void toggleCompass() }}
                                className={`inline-flex h-7 items-center gap-1 border px-2 text-xs font-mono transition cursor-pointer ${
                                    compassEnabled
                                        ? 'border-green-500 bg-green-950/60 text-green-300'
                                        : 'border-green-900 bg-black text-green-700 hover:border-green-700 hover:text-green-400'
                                }`}
                                aria-label={compassEnabled ? 'Выключить вращение по компасу' : 'Включить вращение по компасу'}
                                title={compassEnabled ? 'Вращение включено' : 'Вращение выключено'}
                            >
                                АВТОВРАЩАТЬ
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-7 w-7 items-center justify-center border border-green-900 text-green-700 transition hover:border-green-700 hover:text-green-400 cursor-pointer font-mono text-base leading-none"
                                aria-label="Закрыть радар"
                                title="Закрыть"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {!position && (
                        <div className="border border-green-900/50 bg-green-950/20 px-3 py-2 text-xs font-mono text-green-700">
                            {!isSupported ? '// геолокация недоступна' : error ?? '// определяем координаты...'}
                        </div>
                    )}

                    {position && (
                        <>
                            <div className="flex-1 min-h-0 flex items-center justify-center">
                                <svg
                                    viewBox={`0 0 ${String(RADAR_SIZE)} ${String(RADAR_SIZE)}`}
                                    className="aspect-square max-h-full max-w-full"
                                    role="img"
                                    aria-label="Круговой радар райдеров"
                                >
                                    <defs>
                                        <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                                            <stop offset="0%" stopColor="#002200" />
                                            <stop offset="100%" stopColor="#000d00" />
                                        </radialGradient>
                                    </defs>
                                    <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={RADAR_RADIUS} fill="url(#radarBg)" stroke="#00ff41" strokeWidth="1" strokeOpacity="0.35" />
                                    {ringKm.map((km) => (
                                        <g key={km}>
                                            <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={RADAR_RADIUS * normalizeRadius(km)} fill="none" stroke="#00ff41" strokeOpacity="0.18" strokeDasharray="3 5" />
                                            <text x={RADAR_CENTER + 5} y={RADAR_CENTER - RADAR_RADIUS * normalizeRadius(km) - 5} fontSize="9" fill="#00aa00" fillOpacity="0.8">
                                                {formatDistance(km)}
                                            </text>
                                        </g>
                                    ))}
                                    <line x1={RADAR_CENTER} y1={RADAR_INNER_PADDING} x2={RADAR_CENTER} y2={RADAR_SIZE - RADAR_INNER_PADDING} stroke="#00ff41" strokeOpacity="0.12" />
                                    <line x1={RADAR_INNER_PADDING} y1={RADAR_CENTER} x2={RADAR_SIZE - RADAR_INNER_PADDING} y2={RADAR_CENTER} stroke="#00ff41" strokeOpacity="0.12" />
                                    {([['С', 0], ['В', 90], ['Ю', 180], ['З', 270]] as [string, number][]).map(([label, bearing]) => {
                                        const rad = ((bearing - headingDeg + 360) % 360) * Math.PI / 180
                                        const lx = RADAR_CENTER + (RADAR_RADIUS + 12) * Math.sin(rad)
                                        const ly = RADAR_CENTER - (RADAR_RADIUS + 12) * Math.cos(rad)
                                        return (
                                            <text key={label} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#00ff41" fillOpacity="0.8" fontWeight="bold">
                                                {label}
                                            </text>
                                        )
                                    })}
                                    <line x1={RADAR_CENTER} y1={RADAR_CENTER} x2={RADAR_CENTER} y2={RADAR_INNER_PADDING} stroke="#00ff41" strokeWidth="1.5" strokeOpacity="0.55">
                                        <animateTransform attributeName="transform" type="rotate" from={`0 ${RADAR_CENTER} ${RADAR_CENTER}`} to={`360 ${RADAR_CENTER} ${RADAR_CENTER}`} dur="3s" repeatCount="indefinite" />
                                    </line>
                                    <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={4} fill="#00ff41" />
                                    {orderedRiders.map((rider) => {
                                        const pixelR = RADAR_RADIUS * normalizeRadius(rider.distanceKm)
                                        const radians = (rider.bearingDeg * Math.PI) / 180
                                        const x = RADAR_CENTER + pixelR * Math.sin(radians)
                                        const y = RADAR_CENTER - pixelR * Math.cos(radians)
                                        const initial = rider.name.replace('@', '').charAt(0).toUpperCase() || '•'
                                        const handleClick = () => { onSelectRider(rider.telegramUserId); onClose() }
                                        return (
                                            <g key={rider.id}>
                                                {rider.avatarUrl && (
                                                    <defs>
                                                        <clipPath id={`rclip-${rider.id}`}>
                                                            <circle cx={x} cy={y} r={11} />
                                                        </clipPath>
                                                    </defs>
                                                )}
                                                {rider.avatarUrl ? (
                                                    <image href={rider.avatarUrl} x={x - 11} y={y - 11} width="22" height="22" clipPath={`url(#rclip-${rider.id})`} className="cursor-pointer" onClick={handleClick} />
                                                ) : (
                                                    <>
                                                        <circle cx={x} cy={y} r={11} fill="#002800" className="cursor-pointer" onClick={handleClick} />
                                                        <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="#00ff41" className="pointer-events-none select-none">{initial}</text>
                                                    </>
                                                )}
                                                <circle cx={x} cy={y} r={11} fill="none" stroke="#00ff41" strokeWidth="1.5" className="pointer-events-none" />
                                            </g>
                                        )
                                    })}
                                </svg>
                            </div>

                            <div className="mt-1 shrink-0 text-xs font-mono text-green-900">
                                // {scaleLog ? `лог · макс ${String(RADAR_MAX_DISTANCE_KM)} км` : `лин · макс ${formatDistance(linearScaleMax)}`}
                            </div>

                            <div className="mt-1.5 shrink-0 flex flex-col gap-px overflow-y-auto max-h-[28vh]">
                                {riders.length === 0 && (
                                    <div className="border border-green-900/40 px-3 py-2 text-xs font-mono text-green-800">
                                        // нет активных райдеров
                                    </div>
                                )}
                                {riders.map((rider) => (
                                    <button
                                        key={rider.id}
                                        type="button"
                                        className="flex items-center gap-2 border border-green-900/30 bg-black px-2 py-1 text-left transition hover:bg-green-950/40 hover:border-green-800 cursor-pointer"
                                        onClick={() => { onSelectRider(rider.telegramUserId); onClose() }}
                                    >
                                        {rider.avatarUrl ? (
                                            <img src={rider.avatarUrl} alt={rider.name} className="h-6 w-6 shrink-0 rounded-full object-cover border border-green-800/50" loading="lazy" />
                                        ) : (
                                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-green-800/50 bg-green-950/60 text-xs font-mono text-green-500">
                                                {rider.name.replace('@', '').charAt(0).toUpperCase() || '•'}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <span className="font-mono text-xs font-semibold text-green-400">{rider.name}</span>
                                            <span className="font-mono text-xs text-green-800 ml-2">
                                                {formatDistance(rider.distanceKm)} · {formatAge(rider.ageMinutes)}
                                            </span>
                                            <span className="block font-mono text-xs text-green-800 ml-2">
                                                {rider.nearestPoint ? `${formatDistance(rider.nearestPoint.distanceKm)} от ${rider.nearestPoint.name}` : ''}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
