import { useEffect, useState, type SyntheticEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    createRoute,
    getRoute,
    updateRoute,
    type AdminMapRoute,
} from '@/admin/lib/adminApi'

interface RouteEditPageProps {
    mode: 'create' | 'edit'
}

type RouteCoordinates = Array<[number, number] | [number, number, number]>

interface FormValue {
    title: string
    description: string
    coordinatesText: string
    flagDisabled: boolean
}

const DEFAULT_VALUE: FormValue = {
    title: '',
    description: '',
    coordinatesText: '[\n  [76.945, 43.238],\n  [76.95, 43.24]\n]',
    flagDisabled: false,
}

function routeToFormValue(route: AdminMapRoute): FormValue {
    return {
        title: route.title,
        description: route.description ?? '',
        coordinatesText: JSON.stringify(route.coordinates, null, 2),
        flagDisabled: route.flag_disabled,
    }
}

function parseCoordinates(text: string): RouteCoordinates {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new Error('Координаты должны быть валидным JSON.')
    }
    if (!Array.isArray(parsed) || parsed.length < 2) {
        throw new Error('Нужно минимум 2 точки.')
    }
    const result: RouteCoordinates = []
    for (const item of parsed as unknown[]) {
        if (!Array.isArray(item) || item.length < 2 || item.length > 3) {
            throw new Error('Каждая точка должна быть массивом [lng, lat] или [lng, lat, ele].')
        }
        const lng = item[0] as unknown
        const lat = item[1] as unknown
        if (typeof lng !== 'number' || lng < -180 || lng > 180) {
            throw new Error('lng должен быть числом от -180 до 180.')
        }
        if (typeof lat !== 'number' || lat < -90 || lat > 90) {
            throw new Error('lat должен быть числом от -90 до 90.')
        }
        if (item.length === 3) {
            const ele = item[2] as unknown
            if (typeof ele !== 'number') throw new Error('Высота должна быть числом.')
            result.push([lng, lat, ele])
        } else {
            result.push([lng, lat])
        }
    }
    return result
}

export function RouteEditPage({ mode }: RouteEditPageProps) {
    const navigate = useNavigate()
    const params = useParams<{ id?: string }>()
    const routeId = mode === 'edit' && params.id ? Number(params.id) : null

    const [value, setValue] = useState<FormValue | null>(mode === 'create' ? DEFAULT_VALUE : null)
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (mode !== 'edit' || routeId === null) return
        const state: { cancelled: boolean } = { cancelled: false }
        void (async () => {
            try {
                const route = await getRoute(routeId)
                if (!state.cancelled) setValue(routeToFormValue(route))
            } catch (err) {
                if (!state.cancelled) setError(err instanceof Error ? err.message : String(err))
            }
        })()
        return () => {
            state.cancelled = true
        }
    }, [mode, routeId])

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!value) return

        const titleTrimmed = value.title.trim()
        if (titleTrimmed.length < 4 || titleTrimmed.length > 99) {
            setError('Название должно содержать от 4 до 99 символов.')
            return
        }

        let coordinates: RouteCoordinates
        try {
            coordinates = parseCoordinates(value.coordinatesText)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            return
        }

        setError(null)
        setSubmitting(true)
        try {
            const payload = {
                title: titleTrimmed,
                description: value.description.trim() || null,
                coordinates,
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

    return (
        <section className="max-w-3xl">
            <header className="mb-4">
                <h1 className="text-xl font-semibold">
                    {mode === 'create' ? 'Новый маршрут' : `Маршрут #${params.id ?? ''}`}
                </h1>
                <p className="mt-1 text-sm text-neutral-600">
                    Координаты — JSON-массив пар <code>[lng, lat]</code> (или <code>[lng, lat, ele]</code>),
                    минимум две точки.
                </p>
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            {value ? (
                <form
                    className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4"
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

                    <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-700">
                            Координаты (JSON)
                        </label>
                        <textarea
                            value={value.coordinatesText}
                            onChange={(event) => {
                                setValue({ ...value, coordinatesText: event.target.value })
                            }}
                            rows={12}
                            spellCheck={false}
                            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs"
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
            ) : (
                <p className="text-sm text-neutral-500">Загрузка…</p>
            )}
        </section>
    )
}
