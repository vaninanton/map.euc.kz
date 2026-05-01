import { Suspense, lazy } from 'react'
import { useYandexMetrika } from '@/hooks/useYandexMetrika'
import { PwaPrompts } from '@/components/PwaPrompts'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'

const EucMap = lazy(async () => {
    const module = await import('@/components/EucMap')
    return { default: module.EucMap }
})

export default function App() {
    useYandexMetrika()
    return (
        <>
            <Suspense fallback={<div className="h-dvh w-full bg-neutral-100" />}>
                <AppErrorBoundary>
                    <EucMap />
                </AppErrorBoundary>
            </Suspense>
            <PwaPrompts />
        </>
    )
}
