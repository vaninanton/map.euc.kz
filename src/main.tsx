import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import App from '@/App'

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
    <App />
  </StrictMode>,
)
registerServiceWorker()
