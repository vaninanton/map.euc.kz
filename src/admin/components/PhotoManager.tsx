import { useCallback, useState, type ChangeEvent } from 'react'
import {
    deletePhoto,
    listPhotos,
    updatePhoto,
    uploadPhoto,
    type AdminPhoto,
} from '@/admin/lib/adminApi'
import { ConfirmDialog } from '@/admin/components/ConfirmDialog'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'

interface PhotoManagerProps {
    pointId: number
}

export function PhotoManager({ pointId }: PhotoManagerProps) {
    const [uploading, setUploading] = useState(false)
    const [confirmTarget, setConfirmTarget] = useState<AdminPhoto | null>(null)

    const load = useCallback(() => listPhotos(pointId), [pointId])
    const { items: photos, setItems: setPhotos, loading, error, setError, reload } =
        useAdminListLoader(load)

    const nextSortOrder = photos.length > 0 ? Math.max(...photos.map((photo) => photo.sort_order)) + 1 : 0

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        if (files.length === 0) return

        setUploading(true)
        setError(null)
        try {
            let order = nextSortOrder
            for (const file of files) {
                await uploadPhoto(pointId, file, null, order)
                order += 1
            }
            await reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setUploading(false)
        }
    }

    const handleAltChange = async (photo: AdminPhoto, altText: string) => {
        try {
            const updated = await updatePhoto(photo.id, { alt_text: altText.trim() || null })
            setPhotos((prev) => prev.map((item) => (item.id === photo.id ? updated : item)))
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }

    const handleSortChange = async (photo: AdminPhoto, value: string) => {
        const next = Number(value)
        if (!Number.isFinite(next) || next < 0) return
        try {
            const updated = await updatePhoto(photo.id, { sort_order: Math.trunc(next) })
            setPhotos((prev) =>
                [...prev.map((item) => (item.id === photo.id ? updated : item))].sort(
                    (a, b) => a.sort_order - b.sort_order,
                ),
            )
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }

    const handleDelete = async () => {
        if (!confirmTarget) return
        const target = confirmTarget
        setConfirmTarget(null)
        try {
            await deletePhoto(target)
            await reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }

    return (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Фотографии</h2>
                <label className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    {uploading ? 'Загрузка…' : 'Добавить'}
                    <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploading}
                        onChange={(event) => {
                            void handleUpload(event)
                        }}
                    />
                </label>
            </header>

            {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            {loading && photos.length === 0 ? (
                <p className="text-sm text-neutral-500">Загрузка…</p>
            ) : photos.length === 0 ? (
                <p className="text-sm text-neutral-500">Фотографий нет.</p>
            ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {photos.map((photo) => (
                        <li
                            key={photo.id}
                            className="flex gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2"
                        >
                            <img
                                src={photo.public_url}
                                alt={photo.alt_text ?? ''}
                                className="h-20 w-28 shrink-0 rounded-md object-cover"
                            />
                            <div className="flex flex-1 flex-col gap-1.5 text-xs">
                                <input
                                    defaultValue={photo.alt_text ?? ''}
                                    placeholder="alt-текст"
                                    onBlur={(event) => {
                                        if (event.target.value !== (photo.alt_text ?? '')) {
                                            void handleAltChange(photo, event.target.value)
                                        }
                                    }}
                                    className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1"
                                />
                                <label className="flex items-center gap-2 text-neutral-600">
                                    sort_order:
                                    <input
                                        type="number"
                                        min={0}
                                        defaultValue={photo.sort_order}
                                        onBlur={(event) => {
                                            if (Number(event.target.value) !== photo.sort_order) {
                                                void handleSortChange(photo, event.target.value)
                                            }
                                        }}
                                        className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1"
                                    />
                                </label>
                                <div className="mt-auto flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConfirmTarget(photo)
                                        }}
                                        className="rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <ConfirmDialog
                open={confirmTarget !== null}
                title="Удалить фото?"
                description="Файл будет удалён из Supabase Storage и из таблицы. Действие необратимо."
                confirmLabel="Удалить"
                danger
                onCancel={() => {
                    setConfirmTarget(null)
                }}
                onConfirm={() => {
                    void handleDelete()
                }}
            />
        </section>
    )
}
