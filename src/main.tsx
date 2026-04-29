import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css';
import { useYandexMetrika } from '@/hooks/useYandexMetrika';
import { PwaPrompts } from '@/components/PwaPrompts';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

const EucMap = lazy(async () => {
  const module = await import('@/components/EucMap');
  return { default: module.EucMap };
});

function AppRoot() {
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

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js?v=${encodeURIComponent(__APP_VERSION__)}`
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch((error: unknown) => {
      console.error('Не удалось зарегистрировать service worker:', error);
    });
  });
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')
createRoot(rootEl).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
registerServiceWorker()
