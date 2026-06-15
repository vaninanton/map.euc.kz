import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import type { MapPointType } from '@/types'
import type { MapPointInput } from '@/admin/lib/adminApi'
import { AdminPointLocationMap } from '@/admin/components/AdminPointLocationMap'
import { useCoordinateHistory } from '@/admin/hooks/useCoordinateHistory'
import { useUndoRedoHotkeys } from '@/admin/hooks/useUndoRedoHotkeys'
import { getUndoRedoShortcuts } from '@/utils/platformShortcuts'

export type PointFormValue = MapPointInput

interface PointFormProps {
    initial: PointFormValue
    submitLabel: string
    onSubmit: (value: PointFormValue) => Promise<void>
    onCancel?: () => void
    children?: ReactNode
}

const TYPE_OPTIONS: Array<{ value: MapPointType; label: string }> = [
    { value: 'point', label: 'Точка' },
    { value: 'socket', label: 'Розетка' },
]

function parseCoordInput(raw: string, fallback: number): number {
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
}

type CoordTuple = [number, number]

export function PointForm({ initial, submitLabel, onSubmit, onCancel, children }: PointFormProps) {
    const [type, setType] = useState<MapPointType>(initial.type)
    const [title, setTitle] = useState(initial.title)
    const [description, setDescription] = useState(initial.description ?? '')
    const [lng, setLng] = useState(String(initial.coordinates[0]))
    const [lat, setLat] = useState(String(initial.coordinates[1]))
    const [flagIsMeeting, setFlagIsMeeting] = useState(initial.flag_is_meeting)
    const [flagHasSocket, setFlagHasSocket] = useState(initial.flag_has_socket)
    const [flagErlan, setFlagErlan] = useState(initial.flag_erlan)
    const [flagDisabled, setFlagDisabled] = useState(initial.flag_disabled)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { reset: resetCoordHistory, prepareCommit, undo: undoCoordStep, redo: redoCoordStep } =
        useCoordinateHistory<CoordTuple>()
    const shortcuts = useMemo(() => getUndoRedoShortcuts(), [])
    const lastCommittedCoords = useRef<CoordTuple>([initial.coordinates[0], initial.coordinates[1]])

    useEffect(() => {
        resetCoordHistory()
    }, [resetCoordHistory])

    const commitCoords = useCallback(
        (next: CoordTuple) => {
            const prev = lastCommittedCoords.current
            if (prev[0] === next[0] && prev[1] === next[1]) return
            prepareCommit(prev)
            lastCommittedCoords.current = next
            setLng(String(next[0]))
            setLat(String(next[1]))
        },
        [prepareCommit],
    )

    const tryCommitCoordsFromInputs = useCallback(() => {
        const lngNum = Number(lng)
        const latNum = Number(lat)
        if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) return
        if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) return
        commitCoords([lngNum, latNum])
    }, [lng, lat, commitCoords])

    const undoCoords = useCallback(() => {
        const restored = undoCoordStep(lastCommittedCoords.current)
        if (!restored) return
        lastCommittedCoords.current = restored
        setLng(String(restored[0]))
        setLat(String(restored[1]))
    }, [undoCoordStep])

    const redoCoords = useCallback(() => {
        const restored = redoCoordStep(lastCommittedCoords.current)
        if (!restored) return
        lastCommittedCoords.current = restored
        setLng(String(restored[0]))
        setLat(String(restored[1]))
    }, [redoCoordStep])

    useUndoRedoHotkeys({ onUndo: undoCoords, onRedo: redoCoords })

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)

        const titleTrimmed = title.trim()
        if (titleTrimmed.length < 4 || titleTrimmed.length > 99) {
            setError('Название должно содержать от 4 до 99 символов.')
            return
        }
        const lngNum = Number(lng)
        const latNum = Number(lat)
        if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
            setError('Долгота должна быть числом от -180 до 180.')
            return
        }
        if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
            setError('Широта должна быть числом от -90 до 90.')
            return
        }

        setSubmitting(true)
        try {
            await onSubmit({
                type,
                title: titleTrimmed,
                description: description.trim() || null,
                coordinates: [lngNum, latNum],
                flag_is_meeting: type === 'point' ? flagIsMeeting : false,
                flag_has_socket: type === 'socket' ? true : flagHasSocket,
                flag_erlan: flagErlan,
                flag_disabled: flagDisabled,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="grid w-full gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 lg:min-h-[calc(100dvh-10rem)]">
            <form
                className="flex min-h-0 flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4"
                onSubmit={(event) => {
                    void handleSubmit(event)
                }}
            >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Тип</label>
                    <select
                        value={type}
                        onChange={(event) => {
                            const next = event.target.value as MapPointType
                            setType(next)
                            if (next === 'socket') {
                                setFlagIsMeeting(false)
                                setFlagHasSocket(true)
                            }
                        }}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    >
                        {TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Название</label>
                    <input
                        value={title}
                        onChange={(event) => {
                            setTitle(event.target.value)
                        }}
                        maxLength={99}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Описание</label>
                <textarea
                    value={description}
                    onChange={(event) => {
                        setDescription(event.target.value)
                    }}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Долгота (lng)</label>
                    <input
                        value={lng}
                        onChange={(event) => {
                            setLng(event.target.value)
                        }}
                        onBlur={() => {
                            tryCommitCoordsFromInputs()
                        }}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Широта (lat)</label>
                    <input
                        value={lat}
                        onChange={(event) => {
                            setLat(event.target.value)
                        }}
                        onBlur={() => {
                            tryCommitCoordsFromInputs()
                        }}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-4">
                {type === 'point' && (
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                            type="checkbox"
                            checked={flagIsMeeting}
                            onChange={(event) => {
                                setFlagIsMeeting(event.target.checked)
                            }}
                            className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                        />
                        Место встречи
                    </label>
                )}
                {type === 'point' && (
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                            type="checkbox"
                            checked={flagHasSocket}
                            onChange={(event) => {
                                setFlagHasSocket(event.target.checked)
                            }}
                            className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                        />
                        Есть розетка
                    </label>
                )}
                <label
                    className="flex items-center gap-2 text-sm text-neutral-700"
                    title="проезжает только Ерлан"
                >
                    <input
                        type="checkbox"
                        checked={flagErlan}
                        onChange={(event) => {
                            setFlagErlan(event.target.checked)
                        }}
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                    />
                    Ерландия
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                        type="checkbox"
                        checked={flagDisabled}
                        onChange={(event) => {
                            setFlagDisabled(event.target.checked)
                        }}
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                    />
                    Скрыть с карты
                </label>
            </div>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                    {submitting ? 'Сохранение…' : submitLabel}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60"
                    >
                        Отмена
                    </button>
                )}
            </div>
            {children}
        </form>

            <div className="flex min-h-[280px] min-w-0 flex-col gap-2 lg:min-h-0">
                <div className="shrink-0">
                    <h2 className="text-sm font-medium text-neutral-800">Карта</h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                        Отмена шага по координатам: {shortcuts.undo}; повтор: {shortcuts.redo} (не в полях ввода).
                    </p>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <AdminPointLocationMap
                        coordinates={[
                            parseCoordInput(lng, initial.coordinates[0]),
                            parseCoordInput(lat, initial.coordinates[1]),
                        ]}
                        onChange={(next) => {
                            commitCoords(next)
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
