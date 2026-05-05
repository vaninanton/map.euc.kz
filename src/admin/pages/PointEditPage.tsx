import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    createPoint,
    deletePoint,
    getPoint,
    updatePoint,
    type AdminMapPoint,
} from '@/admin/lib/adminApi'
import { ConfirmDialog } from '@/admin/components/ConfirmDialog'
import { PointForm, type PointFormValue } from '@/admin/components/PointForm'
import { PhotoManager } from '@/admin/components/PhotoManager'
import { getUndoRedoShortcuts } from '@/utils/platformShortcuts'

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
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const shortcuts = getUndoRedoShortcuts()

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

    const handleDelete = async () => {
        if (pointId === null) return
        setDeleting(true)
        try {
            await deletePoint(pointId)
            await navigate('/admin/points')
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    return (
        <section className="w-full max-w-none">
            <header className="mb-4">
                <h1 className="text-xl font-semibold">
                    {mode === 'create' ? 'Новая точка' : `Точка #${params.id ?? ''}`}
                </h1>
                <p className="mt-1 text-sm text-neutral-600">
                    Шаги отменяются {shortcuts.undo} и повторяются {shortcuts.redo} (вне полей ввода).
                </p>
                {mode === 'edit' && pointId !== null && (
                    <div className="mt-3">
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => {
                                setConfirmDelete(true)
                            }}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                            Удалить точку
                        </button>
                    </div>
                )}
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            {initial ? (
                <PointForm
                    key={mode === 'edit' && pointId !== null ? String(pointId) : 'create'}
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

            <ConfirmDialog
                open={confirmDelete}
                title="Удалить точку?"
                description="Будет удалена точка и все связанные с ней фото. Действие необратимо."
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
