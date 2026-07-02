import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type AdminAuthState =
    | { status: 'loading' }
    | { status: 'misconfigured'; message: string }
    | { status: 'unauthenticated' }
    | { status: 'forbidden'; user: User }
    | { status: 'ready'; user: User }

export function useAdminAuth(): AdminAuthState {
    const [state, setState] = useState<AdminAuthState>(() =>
        supabase ? { status: 'loading' } : { status: 'misconfigured', message: 'Supabase не настроен.' },
    )

    useEffect(() => {
        if (!supabase) return
        const client = supabase
        let cancelled = false
        // Кэш проверки членства: для уже проверенного пользователя не перезапрашиваем
        // map_admin_users на каждое событие auth (INITIAL_SESSION / TOKEN_REFRESHED / SIGNED_IN).
        let checkedUserId: string | null = null

        const resolve = async (session: Session | null) => {
            const user = session?.user ?? null
            if (!user) {
                checkedUserId = null
                if (!cancelled) setState({ status: 'unauthenticated' })
                return
            }
            // Тот же пользователь уже проверен — только события токена, запрос не нужен.
            if (user.id === checkedUserId) return

            const { data, error } = await client
                .from('map_admin_users')
                .select('user_id')
                .eq('user_id', user.id)
                .maybeSingle()
            if (cancelled) return
            checkedUserId = user.id
            if (error) {
                console.error('useAdminAuth:', error)
                setState({ status: 'forbidden', user })
                return
            }
            setState({ status: data ? 'ready' : 'forbidden', user })
        }

        // onAuthStateChange сразу эмитит INITIAL_SESSION при подписке — это и есть
        // первичная загрузка, поэтому отдельный getSession() на маунте не нужен
        // (иначе получаем два одновременных запроса к map_admin_users).
        const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
            void resolve(session)
        })

        return () => {
            cancelled = true
            subscription.subscription.unsubscribe()
        }
    }, [])

    return state
}
