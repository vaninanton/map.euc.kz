import { useCallback, useState } from 'react'
import { useAdminListLoader } from '@/admin/hooks/useAdminListLoader'
import {
    deletePasskey,
    isPasskeySupported,
    listPasskeys,
    registerPasskey,
    renamePasskey,
    type AdminPasskey,
} from '@/admin/lib/passkeys'
import { formatAdminDate } from '@/admin/utils/formatAdminDate'

function defaultPasskeyName(): string {
    // Подсказываем понятное имя: пасскеев может быть несколько (телефон, ноутбук, ключ).
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
    if (/iPhone|iPad/i.test(ua)) return 'iPhone'
    if (/Android/i.test(ua)) return 'Android'
    if (/Macintosh/i.test(ua)) return 'Mac'
    if (/Windows/i.test(ua)) return 'Windows'
    return 'Это устройство'
}

export function SettingsPage() {
    const load = useCallback(() => listPasskeys(), [])
    const { items, loading, error, reload } = useAdminListLoader(load)

    const supported = isPasskeySupported()
    const [name, setName] = useState(defaultPasskeyName)
    const [adding, setAdding] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [formError, setFormError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const handleAdd = async () => {
        setAdding(true)
        setFormError(null)
        setNotice(null)
        try {
            const created = await registerPasskey(name)
            setNotice(`Пасскей «${created.friendly_name ?? created.id}» добавлен.`)
            await reload()
        } catch (err) {
            setFormError(err instanceof Error ? err.message : String(err))
        } finally {
            setAdding(false)
        }
    }

    const handleRename = async (passkey: AdminPasskey) => {
        const next = window.prompt('Новое название пасскея', passkey.friendly_name ?? '')
        if (next === null) return
        const trimmed = next.trim()
        if (trimmed.length === 0) return
        setBusyId(passkey.id)
        setFormError(null)
        try {
            await renamePasskey(passkey.id, trimmed)
            await reload()
        } catch (err) {
            setFormError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusyId(null)
        }
    }

    const handleDelete = async (passkey: AdminPasskey) => {
        const label = passkey.friendly_name ?? passkey.id
        if (!window.confirm(`Удалить пасскей «${label}»? Войти с этого устройства без пароля больше не получится.`)) {
            return
        }
        setBusyId(passkey.id)
        setFormError(null)
        try {
            await deletePasskey(passkey.id)
            await reload()
        } catch (err) {
            setFormError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <section>
            <header className="mb-4">
                <h1 className="text-xl font-semibold">Настройки</h1>
                <p className="mt-1 text-sm text-neutral-600">
                    Пасскеи — основной способ входа в админку: вместо пароля используется Face ID / Touch ID / PIN
                    устройства. Пароль остаётся резервным способом на странице входа.
                </p>
            </header>

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-sm font-semibold text-neutral-800">Пасскеи</h2>
                    <button
                        type="button"
                        onClick={() => {
                            void reload()
                        }}
                        className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
                    >
                        Обновить
                    </button>
                </div>

                {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                {formError && (
                    <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {formError}
                    </div>
                )}
                {notice && (
                    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>
                )}

                <ul className="mt-3 divide-y divide-neutral-200">
                    {loading && <li className="py-6 text-center text-sm text-neutral-500">Загрузка…</li>}
                    {!loading && items.length === 0 && (
                        <li className="py-6 text-center text-sm text-neutral-500">
                            Пасскеев пока нет. Добавьте первый — и следующий вход будет без пароля.
                        </li>
                    )}
                    {items.map((passkey) => (
                        <li key={passkey.id} className="flex items-center justify-between gap-4 py-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-neutral-900">
                                    {passkey.friendly_name ?? 'Без названия'}
                                </p>
                                <p className="mt-0.5 text-xs text-neutral-500">
                                    Создан: {formatAdminDate(passkey.created_at)} · Последний вход:{' '}
                                    {passkey.last_used_at ? formatAdminDate(passkey.last_used_at) : 'никогда'}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    disabled={busyId === passkey.id}
                                    onClick={() => {
                                        void handleRename(passkey)
                                    }}
                                    className="cursor-pointer rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Переименовать
                                </button>
                                <button
                                    type="button"
                                    disabled={busyId === passkey.id}
                                    onClick={() => {
                                        void handleDelete(passkey)
                                    }}
                                    className="cursor-pointer rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Удалить
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>

                {supported ? (
                    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-4">
                        <div className="flex-1">
                            <label htmlFor="passkey-name" className="mb-1 block text-xs font-medium text-neutral-700">
                                Название устройства
                            </label>
                            <input
                                id="passkey-name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value)
                                }}
                                placeholder="iPhone"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            disabled={adding}
                            onClick={() => {
                                void handleAdd()
                            }}
                            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                        >
                            {adding ? 'Подтвердите на устройстве…' : 'Добавить пасскей'}
                        </button>
                    </div>
                ) : (
                    <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-amber-700">
                        Этот браузер не поддерживает пасскеи (WebAuthn). Добавить пасскей можно из Safari, Chrome или
                        Firefox на устройстве с Face ID / Touch ID / Windows Hello.
                    </p>
                )}
            </div>
        </section>
    )
}
