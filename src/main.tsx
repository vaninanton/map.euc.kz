import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css';
import { EucMap } from '@/components/EucMap';
import { useYandexMetrika } from '@/hooks/useYandexMetrika';

function AppRoot() {
  useYandexMetrika()
  return <EucMap />
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
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
