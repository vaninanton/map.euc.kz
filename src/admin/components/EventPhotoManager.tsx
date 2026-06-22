import { useRef, useState, type ChangeEvent } from 'react'
import { deleteEventPhoto, eventPhotoUrl, setEventPhoto } from '@/admin/lib/adminApi'

interface EventPhotoManagerProps {
    eventId: number
    photoPath: string | null
    onChange: (nextPath: string | null) => void
}

/** Одна фотография события: загрузка, замена, удаление через Supabase Storage. */
export function EventPhotoManager({ eventId, photoPath, onChange }: EventPhotoManagerProps) {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setBusy(true)
        setError(null)
        try {
            const updated = await setEventPhoto(eventId, file, photoPath)
            onChange(updated.photo_path)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    const handleDelete = async () => {
        if (!photoPath) return
        setBusy(true)
        setError(null)
        try {
            const updated = await deleteEventPhoto(eventId, photoPath)
            onChange(updated.photo_path)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800">Фотография</h2>
            {photoPath ? (
                <div className="mt-3">
                    <img
                        src={eventPhotoUrl(photoPath)}
                        alt="Фото события"
                        className="h-40 w-full max-w-sm rounded-lg object-cover"
                    />
                </div>
            ) : (
                <p className="mt-2 text-sm text-neutral-500">Фотография не загружена.</p>
            )}

            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="mt-3 flex gap-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                        void handleFile(e)
                    }}
                    className="hidden"
                />
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                >
                    {photoPath ? 'Заменить фото' : 'Загрузить фото'}
                </button>
                {photoPath && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            void handleDelete()
                        }}
                        className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                        Удалить фото
                    </button>
                )}
            </div>
        </div>
    )
}
