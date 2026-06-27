import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteNews, listNews, type AdminNews } from '@/admin/lib/adminApi'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'
import { ConfirmDialog } from '@/admin/components/ConfirmDialog'
import { formatAdminDate } from '@/admin/utils/formatAdminDate'
import { newsTitlePreview } from '@/utils/newsAnnounce'

export function NewsPage() {
    const navigate = useNavigate()
    const [confirm, setConfirm] = useState<AdminNews | null>(null)
    const [deleting, setDeleting] = useState(false)

    const load = useCallback(() => listNews(), [])
    const { items, loading, error, reload } = useAdminListLoader(load)

    const handleDelete = async () => {
        if (!confirm) return
        setDeleting(true)
        try {
            await deleteNews({ id: confirm.id, photo_path: confirm.photo_path })
            await reload()
        } catch (err) {
            window.alert(err instanceof Error ? err.message : String(err))
        } finally {
            setDeleting(false)
            setConfirm(null)
        }
    }

    return (
        <section>
            <header className="mb-4 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold">Новости проекта</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Сообщения для рассылки в Telegram-чаты. Можно отправить в выбранные чаты, обновить текст во всех
                        отправленных или удалить их.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            void reload()
                        }}
                        className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                    >
                        Обновить
                    </button>
                    <Link
                        to="new"
                        className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Создать
                    </Link>
                </div>
            </header>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                            <th className="px-3 py-2 font-medium">Новость</th>
                            <th className="px-3 py-2 font-medium">Создано</th>
                            <th className="px-3 py-2 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {loading && (
                            <tr>
                                <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                                    Загрузка…
                                </td>
                            </tr>
                        )}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                                    Новостей пока нет.
                                </td>
                            </tr>
                        )}
                        {items.map((news) => (
                            <tr
                                key={news.id}
                                onClick={() => {
                                    void navigate(`/admin/news/${news.id}`)
                                }}
                                className="cursor-pointer hover:bg-neutral-50"
                            >
                                <td className="px-3 py-2 font-medium">
                                    {newsTitlePreview(news.body) || (
                                        <span className="text-neutral-400">(без текста)</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-neutral-600">{formatAdminDate(news.created_at)}</td>
                                <td className="px-3 py-2 text-right">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setConfirm(news)
                                        }}
                                        className="cursor-pointer rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                    >
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={confirm !== null}
                title="Удалить новость?"
                description="Новость скроется из списка, фото удалится. Отправленные сообщения в Telegram останутся — удалите их отдельно на странице новости перед удалением."
                confirmLabel="Удалить"
                danger
                onCancel={() => {
                    if (!deleting) setConfirm(null)
                }}
                onConfirm={() => {
                    void handleDelete()
                }}
            />
        </section>
    )
}
