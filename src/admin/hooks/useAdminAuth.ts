import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
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

    const refresh = useCallback(async () => {
        if (!supabase) {
            setState({ status: 'misconfigured', message: 'Supabase не настроен.' })
            return
        }
        const {
            data: { session },
        } = await supabase.auth.getSession()
        const user = session?.user ?? null
        if (!user) {
            setState({ status: 'unauthenticated' })
            return
        }
        const { data, error } = await supabase
            .from('map_admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()
        if (error) {
            console.error('useAdminAuth:', error)
            setState({ status: 'forbidden', user })
            return
        }
        if (!data) {
            setState({ status: 'forbidden', user })
            return
        }
        setState({ status: 'ready', user })
    }, [])

    useEffect(() => {
        if (!supabase) return

        void Promise.resolve().then(() => refresh())

        const { data: subscription } = supabase.auth.onAuthStateChange(() => {
            void Promise.resolve().then(() => refresh())
        })

        return () => {
            subscription.subscription.unsubscribe()
        }
    }, [refresh])

    return state
}
