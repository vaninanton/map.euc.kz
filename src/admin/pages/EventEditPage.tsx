import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createEvent, deleteEvent, getEvent, updateEvent, type AdminEvent } from '@/admin/lib/adminApi'
import { ConfirmDialog } from '@/admin/components/ConfirmDialog'
import { EventForm, type EventFormValue } from '@/admin/components/EventForm'
import { EventPhotoManager } from '@/admin/components/EventPhotoManager'
import { EventDatesManager } from '@/admin/components/EventDatesManager'

interface EventEditPageProps {
    mode: 'create' | 'edit'
}

const DEFAULT_VALUE: EventFormValue = {
    type: 'group_ride',
    title: '',
    description: null,
    duration_minutes: null,
    location_text: null,
    start_coordinates: null,
    finish_coordinates: null,
    start_point_id: null,
    finish_point_id: null,
    flag_disabled: false,
}

function eventToFormValue(event: AdminEvent): EventFormValue {
    return {
        type: event.type,
        title: event.title,
        description: event.description,
        duration_minutes: event.duration_minutes,
        location_text: event.location_text,
        start_coordinates: event.start_coordinates,
        finish_coordinates: event.finish_coordinates,
        start_point_id: event.start_point_id,
        finish_point_id: event.finish_point_id,
        flag_disabled: event.flag_disabled,
    }
}

export function EventEditPage({ mode }: EventEditPageProps) {
    const navigate = useNavigate()
    const params = useParams<{ id?: string }>()
    const eventIdRaw = params.id !== undefined && params.id !== '' ? Number(params.id) : NaN
    const eventId = mode === 'edit' && Number.isFinite(eventIdRaw) ? eventIdRaw : null

    const [event, setEvent] = useState<AdminEvent | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // initial выводится из загруженного события (edit) либо из дефолта (create) — без отдельного состояния.
    const initial: EventFormValue | null = mode === 'create' ? DEFAULT_VALUE : event ? eventToFormValue(event) : null

    useEffect(() => {
        if (mode !== 'edit' || eventId === null) return
        const state = { cancelled: false }
        void (async () => {
            try {
                const loaded = await getEvent(eventId)
                if (!state.cancelled) setEvent(loaded)
            } catch (err) {
                if (!state.cancelled) setError(err instanceof Error ? err.message : String(err))
            }
        })()
        return () => {
            state.cancelled = true
        }
    }, [mode, eventId])

    const handleSubmit = async (value: EventFormValue) => {
        if (mode === 'create') {
            const created = await createEvent(value)
            await navigate(`/admin/event/${String(created.id)}`, { replace: true })
        } else if (eventId !== null) {
            await updateEvent(eventId, value)
            await navigate('/admin/event')
        }
    }

    const handleDelete = async () => {
        if (eventId === null) return
        setDeleting(true)
        try {
            await deleteEvent({ id: eventId, photo_path: event?.photo_path ?? null })
            await navigate('/admin/event')
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
                    {mode === 'create' ? 'Новое событие' : `Событие #${params.id ?? ''}`}
                </h1>
                {mode === 'edit' && eventId !== null && (
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => {
                                setConfirmDelete(true)
                            }}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                            Удалить событие
                        </button>
                    </div>
                )}
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            {initial ? (
                <div className="flex flex-col gap-6">
                    <EventForm
                        key={mode === 'edit' && eventId !== null ? String(eventId) : 'create'}
                        initial={initial}
                        submitLabel={mode === 'create' ? 'Создать' : 'Сохранить'}
                        onSubmit={handleSubmit}
                        onCancel={() => {
                            void navigate('/admin/event')
                        }}
                    />
                    {mode === 'edit' && eventId !== null && event && (
                        <>
                            <EventDatesManager event={event} />
                            <EventPhotoManager
                                eventId={eventId}
                                photoPath={event.photo_path}
                                onChange={(nextPath) => {
                                    setEvent((prev) => (prev ? { ...prev, photo_path: nextPath } : prev))
                                }}
                            />
                        </>
                    )}
                </div>
            ) : (
                <p className="text-sm text-neutral-500">Загрузка…</p>
            )}

            <ConfirmDialog
                open={confirmDelete}
                title="Удалить событие?"
                description="Будет удалено событие, его фото и все даты. Действие необратимо."
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
