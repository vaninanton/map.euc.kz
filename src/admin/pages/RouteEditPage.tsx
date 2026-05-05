import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoordinateHistory } from '@/admin/hooks/useCoordinateHistory'
import { useUndoRedoHotkeys } from '@/admin/hooks/useUndoRedoHotkeys'
import {
    createRoute,
    deleteRoute,
    getRoute,
    updateRoute,
    type AdminMapRoute,
} from '@/admin/lib/adminApi'
import { ConfirmDialog } from '@/admin/components/ConfirmDialog'
import { AdminRoutePolylineMap } from '@/admin/components/AdminRoutePolylineMap'
import type { RouteEditorCoordinates } from '@/admin/route-editor/routeGeometry'
import { validateMinimumVertices, validateRouteTitleTrimmed } from '@/admin/route-editor/routeValidation'
import { RouteVertexEditorList } from '@/admin/components/RouteVertexEditorList'
import { fillMissingRouteElevations } from '@/utils/fetchMissingRouteElevations'
import { getUndoRedoShortcuts } from '@/utils/platformShortcuts'
import { routeVertexElevationStats } from '@/utils/routeVertexElevationStats'
import { simplifyRouteCollinear } from '@/utils/simplifyRouteCollinear'

interface RouteEditPageProps {
    mode: 'create' | 'edit'
}

interface FormValue {
    title: string
    description: string
    coordinates: RouteEditorCoordinates
    flagDisabled: boolean
}

const DEFAULT_COORDINATES: RouteEditorCoordinates = [
    [76.945, 43.238],
    [76.95, 43.24],
]

const DEFAULT_VALUE: FormValue = {
    title: '',
    description: '',
    coordinates: DEFAULT_COORDINATES,
    flagDisabled: false,
}

function routeToFormValue(route: AdminMapRoute): FormValue {
    return {
        title: route.title,
        description: route.description ?? '',
        coordinates: route.coordinates,
        flagDisabled: route.flag_disabled,
    }
}

export function RouteEditPage({ mode }: RouteEditPageProps) {
    const navigate = useNavigate()
    const params = useParams<{ id?: string }>()
    const routeIdRaw = params.id !== undefined && params.id !== '' ? Number(params.id) : NaN
    const routeId = mode === 'edit' && Number.isFinite(routeIdRaw) ? routeIdRaw : null

    const [value, setValue] = useState<FormValue | null>(mode === 'create' ? DEFAULT_VALUE : null)
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [fillingElevations, setFillingElevations] = useState(false)
    const [hoveredVertexIndex, setHoveredVertexIndex] = useState<number | null>(null)
    const { reset: resetCoordHistory, prepareCommit, undo: undoCoordStep, redo: redoCoordStep } =
        useCoordinateHistory<RouteEditorCoordinates>()

    useEffect(() => {
        if (mode !== 'edit' || routeId === null) return
        const state: { cancelled: boolean } = { cancelled: false }
        void (async () => {
            try {
                const route = await getRoute(routeId)
                if (!state.cancelled) {
                    const fv = routeToFormValue(route)
                    resetCoordHistory()
                    setValue(fv)
                }
            } catch (err) {
                if (!state.cancelled) setError(err instanceof Error ? err.message : String(err))
            }
        })()
        return () => {
            state.cancelled = true
        }
    }, [mode, routeId, resetCoordHistory])

    const commitRouteCoordinates = useCallback(
        (next: RouteEditorCoordinates) => {
            setValue((prev) => {
                if (!prev) return prev
                if (JSON.stringify(prev.coordinates) === JSON.stringify(next)) return prev
                prepareCommit(prev.coordinates)
                return { ...prev, coordinates: next }
            })
        },
        [prepareCommit],
    )

    const undoRouteCoordinates = useCallback(() => {
        setValue((prev) => {
            if (!prev) return prev
            const restored = undoCoordStep(prev.coordinates)
            if (restored === null) return prev
            return { ...prev, coordinates: restored }
        })
    }, [undoCoordStep])

    const redoRouteCoordinates = useCallback(() => {
        setValue((prev) => {
            if (!prev) return prev
            const restored = redoCoordStep(prev.coordinates)
            if (restored === null) return prev
            return { ...prev, coordinates: restored }
        })
    }, [redoCoordStep])

    useUndoRedoHotkeys({ onUndo: undoRouteCoordinates, onRedo: redoRouteCoordinates })

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!value) return

        const titleTrimmed = value.title.trim()
        const titleErr = validateRouteTitleTrimmed(titleTrimmed)
        if (titleErr) {
            setError(titleErr)
            return
        }

        const vertexErr = validateMinimumVertices(value.coordinates.length)
        if (vertexErr) {
            setError(vertexErr)
            return
        }

        setError(null)
        setSubmitting(true)
        try {
            const payload = {
                title: titleTrimmed,
                description: value.description.trim() || null,
                coordinates: value.coordinates,
                flag_disabled: value.flagDisabled,
            }
            if (mode === 'create') {
                const created = await createRoute(payload)
                await navigate(`/admin/routes/${String(created.id)}`, { replace: true })
            } else if (routeId !== null) {
                await updateRoute(routeId, payload)
                await navigate('/admin/routes')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (routeId === null) return
        setDeleting(true)
        try {
            await deleteRoute(routeId)
            await navigate('/admin/routes')
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    const simplifyRoute = () => {
        if (!value || value.coordinates.length <= 2) return
        commitRouteCoordinates(simplifyRouteCollinear(value.coordinates))
    }

    const fillRouteElevations = async () => {
        if (!value) return
        const hasMissing = value.coordinates.some((coord) => coord.length < 3)
        if (!hasMissing) {
            setError('Все точки уже содержат высоту.')
            return
        }

        setError(null)
        setFillingElevations(true)
        try {
            const next = await fillMissingRouteElevations(value.coordinates)
            commitRouteCoordinates(next)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setFillingElevations(false)
        }
    }

    const vertexStats = useMemo(
        () => (value ? routeVertexElevationStats(value.coordinates) : null),
        [value],
    )

    const effectiveHoveredVertexIndex = useMemo(() => {
        if (!value || hoveredVertexIndex === null) return null
        if (hoveredVertexIndex < 0 || hoveredVertexIndex >= value.coordinates.length) return null
        return hoveredVertexIndex
    }, [value, hoveredVertexIndex])
    const shortcuts = useMemo(() => getUndoRedoShortcuts(), [])

    return (
        <section className="w-full max-w-none">
            <header className="mb-4">
                <h1 className="text-xl font-semibold">
                    {mode === 'create' ? 'Новый маршрут' : `Маршрут #${params.id ?? ''}`}
                </h1>
                <p className="mt-1 text-sm text-neutral-600">
                    Двойной клик по маркеру на карте удаляет вершину. Отмена шага: {shortcuts.undo}; повтор:{' '}
                    {shortcuts.redo}
                </p>
                {mode === 'edit' && routeId !== null && (
                    <div className="mt-3">
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => {
                                setConfirmDelete(true)
                            }}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                            Удалить маршрут
                        </button>
                    </div>
                )}
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            {value ? (
                <div className="grid w-full gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 lg:min-h-[calc(100dvh-10rem)]">
                    <form
                        className="flex min-h-0 min-w-0 flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4"
                        onSubmit={(event) => {
                            void handleSubmit(event)
                        }}
                    >
                        <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-700">Название</label>
                            <input
                                value={value.title}
                                onChange={(event) => {
                                    setValue({ ...value, title: event.target.value })
                                }}
                                maxLength={99}
                                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-700">Описание</label>
                            <textarea
                                value={value.description}
                                onChange={(event) => {
                                    setValue({ ...value, description: event.target.value })
                                }}
                                rows={3}
                                className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                            <input
                                type="checkbox"
                                checked={value.flagDisabled}
                                onChange={(event) => {
                                    setValue({ ...value, flagDisabled: event.target.checked })
                                }}
                                className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                            />
                            Скрыть с карты
                        </label>

                        {vertexStats && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-800">
                                <span className="font-medium text-neutral-600">Статистика</span>
                                <span>Всего точек: {vertexStats.vertexCount}</span>
                                <span>С высотой: {vertexStats.withElevationCount}</span>
                                <span>Без высоты: {vertexStats.withoutElevationCount}</span>
                            </div>
                        )}

                        <RouteVertexEditorList
                            coordinates={value.coordinates}
                            onSimplifyRoute={simplifyRoute}
                            onFillMissingElevations={() => {
                                void fillRouteElevations()
                            }}
                            fillingElevations={fillingElevations}
                            highlightedIndex={effectiveHoveredVertexIndex}
                            onCoordinatesChange={commitRouteCoordinates}
                            onValidationError={(message) => {
                                setError(message)
                            }}
                        />

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                            >
                                {submitting ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void navigate('/admin/routes')
                                }}
                                disabled={submitting}
                                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>

                    <div className="flex min-h-[280px] min-w-0 flex-col gap-2 lg:min-h-0">
                        <h2 className="shrink-0 text-sm font-medium text-neutral-800">Карта</h2>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                            <AdminRoutePolylineMap
                                coordinates={value.coordinates}
                                onChange={(next) => {
                                    commitRouteCoordinates(next)
                                }}
                                onVertexHover={setHoveredVertexIndex}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-neutral-500">Загрузка…</p>
            )}

            <ConfirmDialog
                open={confirmDelete}
                title="Удалить маршрут?"
                description="Будет удалён маршрут. Действие необратимо."
                confirmLabel="Удалить"
                danger
                onCancel={() => {
                    if (!deleting) setConfirmDelete(false)
                }}
                onConfirm={() => {
                    void handleDelete()
                }}
            />
        </section>
    )
}
