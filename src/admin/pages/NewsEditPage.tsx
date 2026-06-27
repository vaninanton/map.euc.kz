import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createNews, getNews, updateNews, type AdminNews } from '@/admin/lib/adminApi'
import { NewsPhotoManager } from '@/admin/components/NewsPhotoManager'
import { NewsAnnounceManager } from '@/admin/components/NewsAnnounceManager'

interface NewsEditPageProps {
    mode: 'create' | 'edit'
}

export function NewsEditPage({ mode }: NewsEditPageProps) {
    const navigate = useNavigate()
    const params = useParams<{ id?: string }>()
    const newsId = mode === 'edit' && params.id ? params.id : null

    const [news, setNews] = useState<AdminNews | null>(null)
    const [body, setBody] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mode !== 'edit' || newsId === null) return
        const state = { cancelled: false }
        void (async () => {
            try {
                const loaded = await getNews(newsId)
                if (!state.cancelled) {
                    setNews(loaded)
                    setBody(loaded.body)
                }
            } catch (err) {
                if (!state.cancelled) setError(err instanceof Error ? err.message : String(err))
            }
        })()
        return () => {
            state.cancelled = true
        }
    }, [mode, newsId])

    // Несохранённые изменения текста (для предупреждения в блоке рассылки).
    const hasUnsavedChanges = mode === 'edit' && news !== null && body !== news.body

    const handleSave = async () => {
        if (body.trim().length === 0) {
            setError('Введите текст новости.')
            return
        }
        setSaving(true)
        setError(null)
        try {
            if (mode === 'create') {
                const created = await createNews({ body })
                await navigate(`/admin/news/${created.id}`, { replace: true })
            } else if (newsId !== null) {
                const updated = await updateNews(newsId, { body })
                setNews(updated)
                setBody(updated.body)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="w-full max-w-none">
            <header className="mb-4">
                <h1 className="text-xl font-semibold">{mode === 'create' ? 'Новая новость' : 'Новость'}</h1>
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="flex flex-col gap-6">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <label className="block text-xs font-medium text-neutral-700">Текст новости</label>
                    <textarea
                        value={body}
                        onChange={(e) => {
                            setBody(e.target.value)
                        }}
                        rows={6}
                        placeholder="Текст новости для отправки в чаты…"
                        className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                    <div className="mt-3 flex items-center gap-2">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                                void handleSave()
                            }}
                            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                        >
                            {saving ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                                void navigate('/admin/news')
                            }}
                            className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                        >
                            К списку
                        </button>
                    </div>
                </div>

                {mode === 'edit' && newsId !== null && news && (
                    <>
                        <NewsPhotoManager
                            newsId={newsId}
                            photoPath={news.photo_path}
                            onChange={(nextPath) => {
                                setNews((prev) => (prev ? { ...prev, photo_path: nextPath } : prev))
                            }}
                        />
                        <NewsAnnounceManager newsId={newsId} body={news.body} hasUnsavedChanges={hasUnsavedChanges} />
                    </>
                )}
            </div>
        </section>
    )
}
