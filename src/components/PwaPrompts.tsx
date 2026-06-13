import { useEffect, useState } from 'react';

export function PwaPrompts() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let isMounted = true;
    let trackedRegistration: ServiceWorkerRegistration | null = null;
    let trackedWorker: ServiceWorker | null = null;

    const onControllerChange = () => {
      window.location.reload();
    };

    const onWorkerStateChange = () => {
      if (!trackedWorker || !isMounted) return;
      if (trackedWorker.state === 'installed' && navigator.serviceWorker.controller) {
        setWaitingWorker(trackedRegistration?.waiting ?? trackedWorker);
      }
    };

    const onUpdateFound = () => {
      if (!trackedRegistration) return;
      if (trackedWorker) {
        trackedWorker.removeEventListener('statechange', onWorkerStateChange);
      }
      trackedWorker = trackedRegistration.installing;
      if (!trackedWorker) return;
      trackedWorker.addEventListener('statechange', onWorkerStateChange);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (!isMounted || !registration) return;
      trackedRegistration = registration;
      trackedRegistration.addEventListener('updatefound', onUpdateFound);

      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
      }

      trackedWorker = registration.installing;
      if (trackedWorker) {
        trackedWorker.addEventListener('statechange', onWorkerStateChange);
      }
    });

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      trackedRegistration?.removeEventListener('updatefound', onUpdateFound);
      trackedWorker?.removeEventListener('statechange', onWorkerStateChange);
    };
  }, []);

  const updateApp = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <>
      {waitingWorker && (
        <div className="fixed inset-x-0 top-0 z-30 flex justify-center px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] control-inset-top">
          <div className="flex max-w-[min(100%,24rem)] items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-md">
          <span title={`Версия: ${__APP_VERSION__}`}>Доступно обновление</span>
          <button
            type="button"
            onClick={updateApp}
            className="shrink-0 cursor-pointer rounded bg-white/15 px-2 py-1 text-white hover:bg-white/25"
          >
            Обновить
          </button>
          </div>
        </div>
      )}
    </>
  );
}
