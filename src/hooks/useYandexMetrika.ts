import { useEffect } from 'react';

const METRIKA_ID = import.meta.env.VITE_YANDEX_METRIKA_ID;
const METRIKA_SRC = 'https://mc.yandex.ru/metrika/tag.js';
const METRIKA_OPTIONS = {
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true
} as const;

type YmFunction = ((...args: unknown[]) => void) & {
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: YmFunction;
  }
}

let isMetrikaInitialized = false;

function ensureYmStub() {
  if (typeof window === 'undefined' || window.ym) return;

  const ym: YmFunction = (...args: unknown[]) => {
    (ym.a = ym.a || []).push(args);
  };

  ym.l = Date.now();
  window.ym = ym;
}

function appendMetrikaScript() {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${METRIKA_SRC}"]`)) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = METRIKA_SRC;
  document.head.appendChild(script);
}

export function useYandexMetrika() {
  useEffect(() => {
    if (typeof window === 'undefined' || !METRIKA_ID || isMetrikaInitialized) return;

    const metrikaId = Number(METRIKA_ID);
    if (Number.isNaN(metrikaId)) return;

    ensureYmStub();
    appendMetrikaScript();
    window.ym?.(metrikaId, 'init', METRIKA_OPTIONS);

    isMetrikaInitialized = true;
  }, []);
}
