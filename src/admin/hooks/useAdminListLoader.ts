import { useCallback, useEffect, useState } from 'react'

/** Загрузка списка из API: состояние, reload при смене `loader`. */
export function useAdminListLoader<T>(loader: () => Promise<T[]>) {
    const [items, setItems] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const reload = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            setItems(await loader())
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [loader])

    useEffect(() => {
        void Promise.resolve().then(() => reload())
    }, [reload])

    return { items, setItems, loading, error, setError, reload }
}
