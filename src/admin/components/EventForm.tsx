import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react'
import type { EventType } from '@/types'
import { listPoints, type EventInput } from '@/admin/lib/adminApi'
import { AdminPointLocationMap } from '@/admin/components/AdminPointLocationMap'
import { MAP_CENTER } from '@/constants'

export type EventFormValue = EventInput

interface EventFormProps {
    initial: EventFormValue
    submitLabel: string
    onSubmit: (value: EventFormValue) => Promise<void>
    onCancel?: () => void
    children?: ReactNode
}

const TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
    { value: 'group_ride', label: 'Покатушка' },
    { value: 'event', label: 'Мероприятие' },
    { value: 'training', label: 'Обучение' },
]

type EndpointMode = 'none' | 'point' | 'coordinates'

interface EndpointOption {
    id: number
    title: string
}

interface EndpointPickerProps {
    label: string
    points: EndpointOption[]
    pointsLoading: boolean
    pointId: number | null
    coordinates: [number, number] | null
    onChangePointId: (id: number | null) => void
    onChangeCoordinates: (next: [number, number] | null) => void
}

function EndpointPicker({
    label,
    points,
    pointsLoading,
    pointId,
    coordinates,
    onChangePointId,
    onChangeCoordinates,
}: EndpointPickerProps) {
    const mode: EndpointMode = pointId !== null ? 'point' : coordinates !== null ? 'coordinates' : 'none'
    const coords = coordinates ?? MAP_CENTER

    const setMode = (next: EndpointMode) => {
        if (next === 'none') {
            onChangePointId(null)
            onChangeCoordinates(null)
        } else if (next === 'point') {
            onChangeCoordinates(null)
            onChangePointId(points[0]?.id ?? null)
        } else {
            onChangePointId(null)
            onChangeCoordinates([MAP_CENTER[0], MAP_CENTER[1]])
        }
    }

    const MODE_OPTIONS: Array<[EndpointMode, string]> = [
        ['none', 'Нет'],
        ['point', 'Точка'],
        ['coordinates', 'Координаты'],
    ]

    return (
        <div className="rounded-lg border border-neutral-200 p-3">
            <div className="mb-2 text-sm font-medium text-neutral-700">{label}</div>
            <div className="flex gap-1.5">
                {MODE_OPTIONS.map(([value, optLabel]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => { setMode(value); }}
                        className={`cursor-pointer rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                            mode === value
                                ? 'bg-blue-600 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                    >
                        {optLabel}
                    </button>
                ))}
            </div>

            {mode === 'point' && (
                <div className="mt-3">
                    {pointsLoading ? (
                        <p className="text-sm text-neutral-500">Загрузка точек…</p>
                    ) : points.length === 0 ? (
                        <p className="text-sm text-neutral-500">Точек нет. Сначала создайте точку.</p>
                    ) : (
                        <select
                            value={pointId ?? ''}
                            onChange={(e) => { onChangePointId(Number(e.target.value)); }}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        >
                            {points.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.title} (#{p.id})
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {mode === 'coordinates' && (
                <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="mb-1 block text-xs text-neutral-500">Долгота</span>
                            <input
                                value={String(coords[0])}
                                onChange={(e) => {
                                    const n = Number(e.target.value)
                                    onChangeCoordinates([Number.isFinite(n) ? n : coords[0], coords[1]])
                                }}
                                inputMode="decimal"
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
                            />
                        </div>
                        <div>
                            <span className="mb-1 block text-xs text-neutral-500">Широта</span>
                            <input
                                value={String(coords[1])}
                                onChange={(e) => {
                                    const n = Number(e.target.value)
                                    onChangeCoordinates([coords[0], Number.isFinite(n) ? n : coords[1]])
                                }}
                                inputMode="decimal"
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex h-72 flex-col">
                        <AdminPointLocationMap coordinates={coords} onChange={(next) => { onChangeCoordinates(next); }} />
                    </div>
                </div>
            )}
        </div>
    )
}

export function EventForm({ initial, submitLabel, onSubmit, onCancel, children }: EventFormProps) {
    const [type, setType] = useState<EventType>(initial.type)
    const [title, setTitle] = useState(initial.title)
    const [description, setDescription] = useState(initial.description ?? '')
    const [durationMinutes, setDurationMinutes] = useState(initial.duration_minutes ? String(initial.duration_minutes) : '')
    const [locationText, setLocationText] = useState(initial.location_text ?? '')
    const [startCoordinates, setStartCoordinates] = useState<[number, number] | null>(initial.start_coordinates)
    const [finishCoordinates, setFinishCoordinates] = useState<[number, number] | null>(initial.finish_coordinates)
    const [startPointId, setStartPointId] = useState<number | null>(initial.start_point_id)
    const [finishPointId, setFinishPointId] = useState<number | null>(initial.finish_point_id)
    const [flagDisabled, setFlagDisabled] = useState(initial.flag_disabled)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [points, setPoints] = useState<EndpointOption[]>([])
    const [pointsLoading, setPointsLoading] = useState(true)
    useEffect(() => {
        const state = { cancelled: false }
        void Promise.resolve().then(async () => {
            try {
                const list = await listPoints()
                if (!state.cancelled) setPoints(list.map((p) => ({ id: p.id, title: p.title })))
            } catch {
                // молча: привязка точки — необязательная функция
            } finally {
                if (!state.cancelled) setPointsLoading(false)
            }
        })
        return () => {
            state.cancelled = true
        }
    }, [])

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)

        const titleTrimmed = title.trim()
        if (titleTrimmed.length < 4 || titleTrimmed.length > 99) {
            setError('Название должно содержать от 4 до 99 символов.')
            return
        }
        const durationNum = durationMinutes.trim() ? Number(durationMinutes) : null
        if (durationNum !== null && (!Number.isFinite(durationNum) || durationNum <= 0)) {
            setError('Длительность должна быть положительным числом минут.')
            return
        }

        setSubmitting(true)
        try {
            await onSubmit({
                type,
                title: titleTrimmed,
                description: description.trim() || null,
                duration_minutes: durationNum,
                location_text: locationText.trim() || null,
                // Точка приоритетнее координат: при выбранной точке координаты не пишем.
                start_coordinates: startPointId !== null ? null : startCoordinates,
                finish_coordinates: finishPointId !== null ? null : finishCoordinates,
                start_point_id: startPointId,
                finish_point_id: finishPointId,
                flag_disabled: flagDisabled,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form
            className="flex max-w-2xl flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4"
            onSubmit={(event) => {
                void handleSubmit(event)
            }}
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Тип</label>
                    <select
                        value={type}
                        onChange={(e) => { setType(e.target.value as EventType); }}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    >
                        {TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Название</label>
                    <input
                        value={title}
                        onChange={(e) => { setTitle(e.target.value); }}
                        maxLength={99}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Описание</label>
                <textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); }}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Длительность, мин (необязательно)
                    </label>
                    <input
                        type="number"
                        min={1}
                        value={durationMinutes}
                        onChange={(e) => { setDurationMinutes(e.target.value); }}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Место (текстом)</label>
                    <input
                        value={locationText}
                        onChange={(e) => { setLocationText(e.target.value); }}
                        placeholder="Например, Сайран"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                </div>
            </div>

            {/* Старт / финиш */}
            <div className="space-y-3">
                <EndpointPicker
                    label="Старт"
                    points={points}
                    pointsLoading={pointsLoading}
                    pointId={startPointId}
                    coordinates={startCoordinates}
                    onChangePointId={setStartPointId}
                    onChangeCoordinates={setStartCoordinates}
                />
                <EndpointPicker
                    label="Финиш"
                    points={points}
                    pointsLoading={pointsLoading}
                    pointId={finishPointId}
                    coordinates={finishCoordinates}
                    onChangePointId={setFinishPointId}
                    onChangeCoordinates={setFinishCoordinates}
                />
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                    type="checkbox"
                    checked={flagDisabled}
                    onChange={(e) => { setFlagDisabled(e.target.checked); }}
                    className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                />
                Скрыть с сайта
            </label>

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
    )
}
