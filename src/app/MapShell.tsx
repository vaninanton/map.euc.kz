import { Suspense, lazy } from 'react'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'

const EucMap = lazy(async () => {
    const module = await import('@/components/EucMap')
    return { default: module.EucMap }
})

/** Карта: главная и deep-link `m/:type/:id`. */
export function MapShell() {
    return (
        <Suspense fallback={<div className="h-dvh w-full bg-neutral-100" />}>
            <AppErrorBoundary>
                <EucMap />
            </AppErrorBoundary>
        </Suspense>
    )
}
