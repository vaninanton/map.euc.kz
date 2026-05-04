import { Suspense, lazy } from 'react'
import { YandexMetrika } from '@/components/YandexMetrika'
import { PwaPrompts } from '@/components/PwaPrompts'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'

const EucMap = lazy(async () => {
    const module = await import('@/components/EucMap')
    return { default: module.EucMap }
})

export default function App() {
    return (
        <>
            <YandexMetrika />
            <Suspense fallback={<div className="h-dvh w-full bg-neutral-100" />}>
                <AppErrorBoundary>
                    <EucMap />
                </AppErrorBoundary>
            </Suspense>
            <PwaPrompts />
        </>
    )
}
