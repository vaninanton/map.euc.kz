import { useMemo, useState } from 'react'
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
        })
    }

    riders.sort((a, b) => a.distanceKm - b.distanceKm)
    return riders
}

export function RadarModal({ isOpen, onClose, telegramUsersGeo, onSelectRider }: RadarModalProps) {
    const { position, error, isSupported } = useUserGeolocation(isOpen)
    const { heading, compassEnabled, toggleCompass } = useDeviceCompassHeading(isOpen)
    const headingDeg = heading ?? 0
    const [scaleLog, setScaleLog] = useState(true)

    const riders = useMemo(() => {
        if (!position) return []
        return getRadarRiders(telegramUsersGeo, position.coords.latitude, position.coords.longitude, headingDeg)
    }, [telegramUsersGeo, position, headingDeg])

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

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm">
            <div className="h-full w-full overflow-y-auto safe-area-padding sm:p-6 md:p-8">
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <h2 className="text-2xl font-bold text-neutral-900">Радар райдеров</h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => { setScaleLog((v) => !v) }}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 cursor-pointer"
                                aria-label={scaleLog ? 'Переключить на линейную шкалу' : 'Переключить на логарифмическую шкалу'}
                                title={scaleLog ? 'Шкала: лог → линейная' : 'Шкала: линейная → лог'}
                            >
                                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                                    {scaleLog ? (
                                        <path d="M3 16 Q6 14 9 10 Q12 6 17 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                                    ) : (
                                        <path d="M3 16L17 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    )}
                                    <circle cx="3" cy="16" r="1.5" fill="currentColor" />
                                    <circle cx="17" cy="4" r="1.5" fill="currentColor" />
                                </svg>
                                {scaleLog ? 'Лог' : 'Линейная'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { void toggleCompass() }}
                                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition cursor-pointer ${
                                    compassEnabled
                                        ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                                        : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                                }`}
                                aria-label={compassEnabled ? 'Выключить вращение по компасу' : 'Включить вращение по компасу'}
                                title={compassEnabled ? 'Вращение включено' : 'Вращение выключено'}
                            >
                                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    <path d="M10 10L13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                                </svg>
                                Компас
                            </button>
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
                                    {ringKm.map((km) => (
                                        <g key={km}>
                                            <circle
                                                cx={RADAR_CENTER}
                                                cy={RADAR_CENTER}
                                                r={RADAR_RADIUS * normalizeRadius(km)}
                                                fill="none"
                                                stroke="#d1d5db"
                                                strokeDasharray="4 4"
                                            />
                                            <text
                                                x={RADAR_CENTER + 6}
                                                y={RADAR_CENTER - RADAR_RADIUS * normalizeRadius(km) - 6}
                                                fontSize="10"
                                                fill="#6b7280"
                                            >
                                                {formatDistance(km)}
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
                                        const pixelR = RADAR_RADIUS * normalizeRadius(rider.distanceKm)
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
                                Шкала: {scaleLog ? `логарифмическая, макс. ${String(RADAR_MAX_DISTANCE_KM)} км` : `линейная, макс. ${formatDistance(linearScaleMax)}`}
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
