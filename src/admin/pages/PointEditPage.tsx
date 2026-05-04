import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    createPoint,
    getPoint,
    updatePoint,
    type AdminMapPoint,
} from '@/admin/lib/adminApi'
import { PointForm, type PointFormValue } from '@/admin/components/PointForm'
import { PhotoManager } from '@/admin/components/PhotoManager'

interface PointEditPageProps {
    mode: 'create' | 'edit'
}

const DEFAULT_VALUE: PointFormValue = {
    type: 'point',
    title: '',
    description: null,
    coordinates: [76.945, 43.238],
    flag_is_meeting: false,
    flag_has_socket: false,
    flag_disabled: false,
}

function pointToFormValue(point: AdminMapPoint): PointFormValue {
    return {
        type: point.type,
        title: point.title,
        description: point.description,
        coordinates: point.coordinates,
        flag_is_meeting: point.flag_is_meeting,
        flag_has_socket: point.flag_has_socket,
        flag_disabled: point.flag_disabled,
    }
}

export function PointEditPage({ mode }: PointEditPageProps) {
    const navigate = useNavigate()
    const params = useParams<{ id?: string }>()
    const pointId = mode === 'edit' && params.id ? Number(params.id) : null

    const [initial, setInitial] = useState<PointFormValue | null>(mode === 'create' ? DEFAULT_VALUE : null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (mode !== 'edit' || pointId === null) return
        const state: { cancelled: boolean } = { cancelled: false }
        void (async () => {
            try {
                const point = await getPoint(pointId)
                if (!state.cancelled) setInitial(pointToFormValue(point))
            } catch (err) {
                if (!state.cancelled) setError(err instanceof Error ? err.message : String(err))
            }
        })()
        return () => {
            state.cancelled = true
        }
    }, [mode, pointId])

    const handleSubmit = async (value: PointFormValue) => {
        if (mode === 'create') {
            const created = await createPoint(value)
            await navigate(`/admin/points/${String(created.id)}`, { replace: true })
        } else if (pointId !== null) {
            await updatePoint(pointId, value)
            await navigate('/admin/points')
        }
    }

    return (
        <section className="max-w-3xl">
            <header className="mb-4">
                <h1 className="text-xl font-semibold">
                    {mode === 'create' ? 'Новая точка' : `Точка #${params.id ?? ''}`}
                </h1>
                <p className="mt-1 text-sm text-neutral-600">
                    Заполните поля и сохраните. Координаты — в формате lng, lat.
                </p>
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            {initial ? (
                <PointForm
                    initial={initial}
                    submitLabel={mode === 'create' ? 'Создать' : 'Сохранить'}
                    onSubmit={handleSubmit}
                    onCancel={() => {
                        void navigate('/admin/points')
                    }}
                />
            ) : (
                <p className="text-sm text-neutral-500">Загрузка…</p>
            )}

            {mode === 'edit' && pointId !== null && (
                <div className="mt-6">
                    <PhotoManager pointId={pointId} />
                </div>
            )}
        </section>
    )
}
