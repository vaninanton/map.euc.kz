import { requireSupabase } from '@/lib/supabase'
import { adminUrl } from '@/admin/utils/adminUrl'

/** Куда Supabase вернёт по ссылке из письма — там показывается форма нового пароля. */
export const RESET_PASSWORD_PATH = '/admin/reset-password'

/**
 * Отправляет письмо со ссылкой восстановления.
 * Ссылка не «сбрасывает» пароль сама — она открывает сессию восстановления,
 * после чего пароль нужно задать через `updatePassword`.
 */
export async function sendPasswordReset(email: string): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: adminUrl('/reset-password'),
    })
    if (error) throw error
}

/** Задаёт новый пароль текущей (в том числе восстановительной) сессии. */
export async function updatePassword(password: string): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.auth.updateUser({ password })
    if (error) throw error
}
