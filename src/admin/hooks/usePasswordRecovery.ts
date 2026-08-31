import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { RESET_PASSWORD_PATH } from '@/admin/lib/passwordReset'

/**
 * Ссылка из письма восстановления просто открывает сессию — сама пароль не меняет.
 * Ловим `PASSWORD_RECOVERY` и уводим на форму нового пароля, иначе человек молча
 * оказывается в админке и решает, что ссылка не сработала.
 */
export function usePasswordRecovery(): void {
    const navigate = useNavigate()

    useEffect(() => {
        if (!supabase) return
        const { data } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') void navigate(RESET_PASSWORD_PATH, { replace: true })
        })
        return () => {
            data.subscription.unsubscribe()
        }
    }, [navigate])
}
