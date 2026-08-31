import { useEffect, useState } from 'react'
import { parseAuthRedirectError, stripAuthRedirectError } from '@/admin/utils/authRedirectError'

/**
 * Ошибка OAuth-редиректа (вход или привязка через Telegram), если Supabase вернул её в адресе.
 * Читается один раз при монтировании; параметры вычищаются из истории, чтобы сообщение
 * не всплывало снова при перезагрузке страницы.
 */
export function useAuthRedirectError(): string | null {
    const [error] = useState(() => (typeof window === 'undefined' ? null : parseAuthRedirectError(window.location)))

    useEffect(() => {
        if (!error) return
        window.history.replaceState(null, '', stripAuthRedirectError(window.location))
    }, [error])

    return error
}
