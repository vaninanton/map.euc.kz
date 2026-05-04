import { useMemo } from 'react'
import type { FeatureCollection, TelegramUserProperties } from '@/types/geojson'
import { useUserGeolocation } from '@/hooks/useUserGeolocation'
import { useDeviceCompassHeading } from '@/hooks/useDeviceCompassHeading'
import { bearingDegrees, haversineKm, RADAR_MAX_DISTANCE_KM, RADAR_RING_KM, radarNormalizedRadius } from '@/utils/geoMath'
import { getRadarTtlMinutes } from '@/utils/numberParsers'

interface RadarModalProps {
    isOpen: boolean
    onClose: () => void
    telegramUsersGeo: FeatureCollection | null
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

function getRadarRiders(
    telegramUsersGeo: FeatureCollection | null,
    userLat: number,
    userLon: number,
    headingDeg: number
): RadarRider[] {
    if (!telegramUsersGeo) return []
    const ttlMinutes = getRadarTtlMinutes()
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
        })
    }

    riders.sort((a, b) => a.distanceKm - b.distanceKm)
    return riders
}

export function RadarModal({ isOpen, onClose, telegramUsersGeo, onSelectRider }: RadarModalProps) {
    const { position, error, isSupported } = useUserGeolocation(isOpen)
    const headingDeg = useDeviceCompassHeading(isOpen) ?? 0

    const riders = useMemo(() => {
        if (!position) return []
        return getRadarRiders(telegramUsersGeo, position.coords.latitude, position.coords.longitude, headingDeg)
    }, [telegramUsersGeo, position, headingDeg])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm">
            <div className="h-full w-full overflow-y-auto safe-area-padding sm:p-6 md:p-8">
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <h2 className="text-2xl font-bold text-neutral-900">Радар райдеров</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 cursor-pointer"
                            aria-label="Закрыть радар"
                            title="Закрыть"
                        >
                            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                                <path
                                    d="M6 6L14 14M14 6L6 14"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>

                    {!position && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {!isSupported ? 'Геолокация не поддерживается в этом браузере' : error ?? 'Определяем вашу геопозицию...'}
                        </div>
                    )}

                    {position && (
                        <>
                            <div className="mt-4 flex justify-center">
                                <svg
                                    viewBox={`0 0 ${String(RADAR_SIZE)} ${String(RADAR_SIZE)}`}
                                    className="h-[min(58vw,360px)] w-[min(58vw,360px)] max-h-[360px] max-w-[360px]"
                                    role="img"
                                    aria-label="Круговой радар райдеров"
                                >
                                    <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={RADAR_RADIUS} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                                    {RADAR_RING_KM.map((km) => (
                                        <g key={km}>
                                            <circle
                                                cx={RADAR_CENTER}
                                                cy={RADAR_CENTER}
                                                r={RADAR_RADIUS * radarNormalizedRadius(km)}
                                                fill="none"
                                                stroke="#d1d5db"
                                                strokeDasharray="4 4"
                                            />
                                            <text
                                                x={RADAR_CENTER + 6}
                                                y={RADAR_CENTER - RADAR_RADIUS * radarNormalizedRadius(km) - 6}
                                                fontSize="10"
                                                fill="#6b7280"
                                            >
                                                {String(km)} км
                                            </text>
                                        </g>
                                    ))}
                                    <line x1={RADAR_CENTER} y1={RADAR_INNER_PADDING} x2={RADAR_CENTER} y2={RADAR_SIZE - RADAR_INNER_PADDING} stroke="#e5e7eb" />
                                    <line x1={RADAR_INNER_PADDING} y1={RADAR_CENTER} x2={RADAR_SIZE - RADAR_INNER_PADDING} y2={RADAR_CENTER} stroke="#e5e7eb" />
                                    <text x={RADAR_CENTER} y={18} textAnchor="middle" fontSize="12" fill="#374151">
                                        С
                                    </text>
                                    <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={5} fill="#111827" />
                                    {riders.map((rider) => {
                                        const normalizedR = radarNormalizedRadius(rider.distanceKm)
                                        const pixelR = RADAR_RADIUS * normalizedR
                                        const radians = (rider.bearingDeg * Math.PI) / 180
                                        const x = RADAR_CENTER + pixelR * Math.sin(radians)
                                        const y = RADAR_CENTER - pixelR * Math.cos(radians)
                                        const initial = rider.name.replace('@', '').charAt(0).toUpperCase() || '•'
                                        return (
                                            <g key={rider.id}>
                                                <circle
                                                    cx={x}
                                                    cy={y}
                                                    r={11}
                                                    fill="#8b5cf6"
                                                    stroke="#ffffff"
                                                    strokeWidth="2"
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        onSelectRider(rider.telegramUserId)
                                                        onClose()
                                                    }}
                                                />
                                                <text
                                                    x={x}
                                                    y={y + 4}
                                                    textAnchor="middle"
                                                    fontSize="10"
                                                    fill="#fff"
                                                    className="pointer-events-none select-none"
                                                >
                                                    {initial}
                                                </text>
                                            </g>
                                        )
                                    })}
                                </svg>
                            </div>

                            <div className="mt-4 text-xs text-neutral-500">
                                Шкала радара: логарифмическая, максимум {String(RADAR_MAX_DISTANCE_KM)} км
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                                {riders.length === 0 && (
                                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                                        Сейчас нет активных райдеров
                                    </div>
                                )}
                                {riders.map((rider) => (
                                    <button
                                        key={rider.id}
                                        type="button"
                                        className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-left transition hover:bg-neutral-50 cursor-pointer"
                                        onClick={() => {
                                            onSelectRider(rider.telegramUserId)
                                            onClose()
                                        }}
                                    >
                                        {rider.avatarUrl ? (
                                            <img src={rider.avatarUrl} alt={rider.name} className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                                                {rider.name.replace('@', '').charAt(0).toUpperCase() || '•'}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-neutral-900">{rider.name}</div>
                                            <div className="text-xs text-neutral-600">
                                                {formatDistance(rider.distanceKm)} · обновлено {formatAge(rider.ageMinutes)}
                                            </div>
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
