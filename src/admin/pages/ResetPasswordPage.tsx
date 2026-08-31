import { useId, useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePassword } from '@/admin/lib/passwordReset'

const MIN_LENGTH = 6

/**
 * Форма нового пароля после перехода по ссылке восстановления.
 * К этому моменту Supabase уже открыл сессию — остаётся задать пароль.
 */
export function ResetPasswordPage() {
    const passwordId = useId()
    const repeatId = useId()
    const navigate = useNavigate()

    const [password, setPassword] = useState('')
    const [repeat, setRepeat] = useState('')
    const [touched, setTouched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)

    const tooShort = password.length < MIN_LENGTH
    const mismatch = repeat.length > 0 && repeat !== password
    const isValid = !tooShort && repeat === password

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        setTouched(true)
        if (!isValid) return

        setError(null)
        setSaving(true)
        try {
            await updatePassword(password)
            setDone(true)
            // Сессия восстановления остаётся действующей — уводим в админку.
            setTimeout(() => {
                void navigate('/admin', { replace: true })
            }, 1500)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="mx-auto max-w-sm">
            <h1 className="text-xl font-semibold">Новый пароль</h1>
            <p className="mt-1 text-sm text-neutral-600">
                Вы перешли по ссылке восстановления. Задайте пароль — он заменит прежний.
            </p>

            {done ? (
                <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Пароль обновлён. Открываем админку…
                </div>
            ) : (
                <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)} noValidate>
                    {error && (
                        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor={passwordId} className="mb-1 block text-xs font-medium text-neutral-700">
                            Пароль
                        </label>
                        <input
                            id={passwordId}
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value)
                            }}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        />
                        {touched && tooShort && (
                            <p className="mt-1 text-xs text-red-600">Минимум {MIN_LENGTH} символов</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor={repeatId} className="mb-1 block text-xs font-medium text-neutral-700">
                            Ещё раз
                        </label>
                        <input
                            id={repeatId}
                            type="password"
                            autoComplete="new-password"
                            value={repeat}
                            onChange={(e) => {
                                setRepeat(e.target.value)
                            }}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        />
                        {mismatch && <p className="mt-1 text-xs text-red-600">Пароли не совпадают</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {saving ? 'Сохраняем…' : 'Сохранить пароль'}
                    </button>
                </form>
            )}
        </section>
    )
}
