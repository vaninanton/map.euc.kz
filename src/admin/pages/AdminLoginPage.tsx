import { useState, useId, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import { requireSupabase } from '@/lib/supabase'

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function AdminLoginPage() {
    const emailId = useId()
    const passwordId = useId()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [emailTouched, setEmailTouched] = useState(false)
    const [passwordTouched, setPasswordTouched] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [telegramLoading, setTelegramLoading] = useState(false)

    const handleTelegramLogin = async () => {
        setTelegramLoading(true)
        try {
            const client = requireSupabase()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 'telegram' есть в Supabase, но ещё не добавлен в типы auth-js
            const provider = 'telegram' as any as Parameters<typeof client.auth.signInWithOAuth>[0]['provider']
            const { error: signError } = await client.auth.signInWithOAuth({
                provider,
                options: { redirectTo: window.location.origin + '/admin' },
            })
            if (signError) throw signError
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setTelegramLoading(false)
        }
    }

    const emailError = emailTouched && !isValidEmail(email) ? 'Введите корректный email' : null
    const passwordError = passwordTouched && password.length < 6 ? 'Минимум 6 символов' : null
    const isFormValid = isValidEmail(email) && password.length >= 6

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        setEmailTouched(true)
        setPasswordTouched(true)
        if (!isFormValid) return

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

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-50 p-6">
            <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h1 className="text-lg font-semibold text-neutral-900">Вход в админку</h1>
                <p className="mt-1 text-sm text-neutral-600">
                    Используйте учётную запись Supabase Auth с правами в таблице{' '}
                    <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">map_admin_users</code>.
                </p>

                <div className="mt-4">
                    <button
                        type="button"
                        disabled={telegramLoading}
                        onClick={() => void handleTelegramLogin()}
                        className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
                    >
                        {telegramLoading ? 'Перенаправление…' : 'Войти через Telegram'}
                    </button>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
                    <span className="h-px flex-1 bg-neutral-200" />
                    <span>или</span>
                    <span className="h-px flex-1 bg-neutral-200" />
                </div>

                <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)} noValidate>
                    <div>
                        <label htmlFor={emailId} className="mb-1 block text-xs font-medium text-neutral-700">
                            Email
                        </label>
                        <input
                            id={emailId}
                            type="email"
                            autoComplete="email"
                            value={email}
                            placeholder="admin@example.com"
                            onChange={(e) => {
                                setEmail(e.target.value)
                            }}
                            onBlur={() => {
                                setEmailTouched(true)
                            }}
                            aria-invalid={!!emailError}
                            aria-describedby={emailError ? `${emailId}-error` : undefined}
                            className={[
                                'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
                                'focus:ring-2 focus:ring-blue-500 focus:ring-offset-0',
                                emailError
                                    ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-200'
                                    : 'border-neutral-300 bg-white focus:border-blue-500',
                            ].join(' ')}
                        />
                        {emailError && (
                            <p id={`${emailId}-error`} className="mt-1 text-xs text-red-600">
                                {emailError}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor={passwordId} className="mb-1 block text-xs font-medium text-neutral-700">
                            Пароль
                        </label>
                        <div className="relative">
                            <input
                                id={passwordId}
                                type={showPassword ? 'text' : 'password'}
                                passwordrules="required: upper; required: lower; required: digit; required: special; minlength: 8;"
                                autoComplete="current-password"
                                value={password}
                                placeholder="••••••••"
                                onChange={(e) => {
                                    setPassword(e.target.value)
                                }}
                                onBlur={() => {
                                    setPasswordTouched(true)
                                }}
                                aria-invalid={!!passwordError}
                                aria-describedby={passwordError ? `${passwordId}-error` : undefined}
                                className={[
                                    'w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none transition-colors',
                                    'focus:ring-2 focus:ring-blue-500 focus:ring-offset-0',
                                    passwordError
                                        ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-200'
                                        : 'border-neutral-300 bg-white focus:border-blue-500',
                                ].join(' ')}
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                onClick={() => {
                                    setShowPassword((v) => !v)
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                {showPassword ? (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        aria-hidden
                                    >
                                        <path d="M10 3C5 3 1.73 7.11 1.05 8.45a1 1 0 0 0 0 1.1C1.73 10.89 5 15 10 15s8.27-4.11 8.95-5.45a1 1 0 0 0 0-1.1C18.27 7.11 15 3 10 3zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                    </svg>
                                ) : (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        aria-hidden
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.74-1.74A9.6 9.6 0 0 0 18.95 9.55a1 1 0 0 0 0-1.1C18.27 7.11 15 3 10 3a9.6 9.6 0 0 0-4.72 1.28L3.28 2.22zM10 5a4 4 0 0 1 3.16 6.45L7.55 5.84A3.97 3.97 0 0 1 10 5z"
                                            clipRule="evenodd"
                                        />
                                        <path d="M3.05 8.45A9.9 9.9 0 0 0 2 10c.73 1.34 4 5.45 8 5 a9.45 9.45 0 0 0 3.12-.57l-1.54-1.54A4 4 0 0 1 6.09 7.1L3.05 8.45z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {passwordError && (
                            <p id={`${passwordId}-error`} className="mt-1 text-xs text-red-600">
                                {passwordError}
                            </p>
                        )}
                    </div>

                    {error && (
                        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
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
