import { useState, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import { requireSupabase } from '@/lib/supabase'

export function AdminLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [oauthLoading, setOauthLoading] = useState(false)

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const client = requireSupabase()
            const { error: signError } = await client.auth.signInWithPassword({
                email: email.trim(),
                password,
            })
            if (signError) throw signError
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleTelegramSignIn = async () => {
        setError(null)
        setOauthLoading(true)
        try {
            const client = requireSupabase()
            const { error: oauthError } = await client.auth.signInWithOAuth({
                provider: 'custom:telegram',
                options: {
                    redirectTo: `${window.location.origin}/admin`,
                },
            })
            if (oauthError) throw oauthError
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setOauthLoading(false)
        }
    }

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-50 p-6">
            <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h1 className="text-lg font-semibold text-neutral-900">Вход в админку</h1>
                <p className="mt-1 text-sm text-neutral-600">
                    Используйте учётную запись Supabase Auth с правами в таблице{' '}
                    <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">map_admin_users</code>.
                </p>

                <button
                    type="button"
                    onClick={() => void handleTelegramSignIn()}
                    disabled={oauthLoading || loading}
                    className="mt-4 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:bg-sky-300"
                >
                    {oauthLoading ? 'Переход в Telegram…' : 'Войти через Telegram'}
                </button>

                <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
                    <span className="h-px flex-1 bg-neutral-200" />
                    <span>или</span>
                    <span className="h-px flex-1 bg-neutral-200" />
                </div>

                <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
                    <div>
                        <label htmlFor="admin-email" className="mb-1 block text-xs font-medium text-neutral-700">
                            Email
                        </label>
                        <input
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => {
                                setEmail(event.target.value)
                            }}
                            required
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-password" className="mb-1 block text-xs font-medium text-neutral-700">
                            Пароль
                        </label>
                        <input
                            id="admin-password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value)
                            }}
                            required
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                    >
                        {loading ? 'Вход…' : 'Войти'}
                    </button>
                </form>
            </div>

            <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
                ← На карту
            </Link>
        </div>
    )
}
