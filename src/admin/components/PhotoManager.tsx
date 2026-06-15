import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
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

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function filterImageFiles(files: FileList | File[]): File[] {
    return Array.from(files).filter((f) => ACCEPTED_TYPES.has(f.type))
}

interface LightboxProps {
    photo: AdminPhoto
    total: number
    position: number
    onClose: () => void
    onPrev: () => void
    onNext: () => void
}

function Lightbox({ photo, total, position, onClose, onPrev, onNext }: LightboxProps) {
    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') { onClose() }
            else if (event.key === 'ArrowRight') { onNext() }
            else if (event.key === 'ArrowLeft') { onPrev() }
        }
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('keydown', onKey) }
    }, [onClose, onNext, onPrev])

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={onClose}
        >
            <button
                type="button"
                aria-label="Закрыть"
                className="absolute right-4 top-4 cursor-pointer text-3xl leading-none text-white/70 hover:text-white"
                onClick={onClose}
            >
                ×
            </button>

            {total > 1 && (
                <>
                    <button
                        type="button"
                        aria-label="Предыдущее фото"
                        className="absolute left-4 cursor-pointer rounded-full bg-black/40 px-3 py-2 text-xl text-white hover:bg-black/70"
                        onClick={(e) => { e.stopPropagation(); onPrev() }}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        aria-label="Следующее фото"
                        className="absolute right-4 cursor-pointer rounded-full bg-black/40 px-3 py-2 text-xl text-white hover:bg-black/70"
                        onClick={(e) => { e.stopPropagation(); onNext() }}
                    >
                        ›
                    </button>
                </>
            )}

            <img
                src={photo.public_url}
                alt={photo.alt_text ?? ''}
                className="max-h-[90dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl"
                onClick={(e) => { e.stopPropagation() }}
            />

            {total > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/60">
                    {position} / {total}
                </div>
            )}
        </div>
    )
}

export function PhotoManager({ pointId }: PhotoManagerProps) {
    const [uploading, setUploading] = useState(false)
    const [confirmTarget, setConfirmTarget] = useState<AdminPhoto | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
    const dragCounterRef = useRef(0)

    const load = useCallback(() => listPhotos(pointId), [pointId])
    const { items: photos, setItems: setPhotos, loading, error, setError, reload } =
        useAdminListLoader(load)

    const uploadFiles = useCallback(
        async (files: File[]) => {
            const images = filterImageFiles(files)
            if (images.length === 0) return
            setUploading(true)
            setError(null)
            try {
                let order = photos.length > 0 ? Math.max(...photos.map((p) => p.sort_order)) + 1 : 0
                for (const file of images) {
                    await uploadPhoto(pointId, file, null, order)
                    order += 1
                }
                await reload()
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
            } finally {
                setUploading(false)
            }
        },
        [pointId, photos, reload, setError],
    )

    const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        void uploadFiles(files)
    }

    const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        dragCounterRef.current += 1
        if (dragCounterRef.current === 1) setDragOver(true)
    }

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        dragCounterRef.current -= 1
        if (dragCounterRef.current === 0) setDragOver(false)
    }

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
    }

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        dragCounterRef.current = 0
        setDragOver(false)
        void uploadFiles(Array.from(event.dataTransfer.files))
    }

    useEffect(() => {
        const onPaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items
            if (!items) return
            const files: File[] = []
            for (const item of Array.from(items)) {
                if (item.kind === 'file' && ACCEPTED_TYPES.has(item.type)) {
                    const file = item.getAsFile()
                    if (file) files.push(file)
                }
            }
            if (files.length > 0) {
                event.preventDefault()
                void uploadFiles(files)
            }
        }
        document.addEventListener('paste', onPaste)
        return () => { document.removeEventListener('paste', onPaste); }
    }, [uploadFiles])

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
            if (lightboxIndex !== null) setLightboxIndex(null)
            await reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }

    const closeLightbox = useCallback(() => { setLightboxIndex(null) }, [])
    const prevPhoto = useCallback(
        () => { setLightboxIndex((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null)) },
        [photos.length],
    )
    const nextPhoto = useCallback(
        () => { setLightboxIndex((i) => (i !== null ? (i + 1) % photos.length : null)) },
        [photos.length],
    )

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
                        onChange={handleUpload}
                    />
                </label>
            </header>

            {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={[
                    'rounded-lg border-2 border-dashed p-3 transition-colors',
                    dragOver ? 'border-blue-400 bg-blue-50' : 'border-neutral-200 bg-transparent',
                ].join(' ')}
            >
                {loading && photos.length === 0 ? (
                    <p className="text-sm text-neutral-500">Загрузка…</p>
                ) : photos.length === 0 ? (
                    <p className="text-center text-sm text-neutral-400">
                        {dragOver ? 'Отпустите для загрузки' : 'Перетащите фото сюда или вставьте из буфера обмена'}
                    </p>
                ) : (
                    <>
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {photos.map((photo, i) => (
                                <li
                                    key={photo.id}
                                    className="flex gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2"
                                >
                                    <button
                                        type="button"
                                        aria-label="Открыть фото"
                                        className="h-20 w-28 shrink-0 cursor-zoom-in overflow-hidden rounded-md"
                                        onClick={() => { setLightboxIndex(i); }}
                                    >
                                        <img
                                            src={photo.public_url}
                                            alt={photo.alt_text ?? ''}
                                            className="h-full w-full object-cover"
                                        />
                                    </button>
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
                                                onClick={() => { setConfirmTarget(photo); }}
                                                className="cursor-pointer rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                                            >
                                                Удалить
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {dragOver && (
                            <p className="mt-3 text-center text-sm text-blue-500">Отпустите для загрузки</p>
                        )}
                    </>
                )}
            </div>

            {lightboxIndex !== null && (
                <Lightbox
                     
                    photo={photos[lightboxIndex]}
                    total={photos.length}
                    position={lightboxIndex + 1}
                    onClose={closeLightbox}
                    onPrev={prevPhoto}
                    onNext={nextPhoto}
                />
            )}

            <ConfirmDialog
                open={confirmTarget !== null}
                title="Удалить фото?"
                description="Файл будет удалён из Supabase Storage и из таблицы. Действие необратимо."
                confirmLabel="Удалить"
                danger
                onCancel={() => { setConfirmTarget(null); }}
                onConfirm={() => { void handleDelete() }}
            />
        </section>
    )
}
