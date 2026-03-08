import { useEffect } from 'react';

const METRIKA_ID = import.meta.env.VITE_YANDEX_METRIKA_ID;

export function useYandexMetrika() {
  useEffect(() => {
    if (!METRIKA_ID || typeof window === 'undefined') return;
    const script = document.createElement('script');
    script.innerHTML = `
      (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
        (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
      ym(${METRIKA_ID}, "init", {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true
      });
    `;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);
}
