import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

interface UseMapPaddingOptions {
    map: MapboxMap | null;
    isDesktop: boolean;
    /** FeatureSidebar: mobile bottom 45vh, desktop right 320px */
    hasFeatureSidebar: boolean;
    /** RouteListSidebar / PointListSidebar: mobile bottom 80vh, desktop left 360px */
    hasListSidebar: boolean;
}

/** Вычисляет целевой padding карты под открытые панели (без base-отступа). */
export function computeMapPadding(isDesktop: boolean, hasFeatureSidebar: boolean, hasListSidebar: boolean): { top: number; right: number; bottom: number; left: number } {
    let bottom = 0, right = 0, left = 0;
    if (isDesktop) {
        if (hasFeatureSidebar) right = 320;
        if (hasListSidebar) left = 360;
    } else {
        if (hasFeatureSidebar) bottom = Math.round(window.innerHeight * 0.45);
        else if (hasListSidebar) bottom = Math.round(window.innerHeight * 0.80);
    }
    return { top: 0, right, bottom, left };
}

/**
 * Подстраивает видимую область карты под открытые панели через map.easeTo({ padding }).
 * Если текущий map.padding уже совпадает с целевым — easeTo не вызывается
 * (предотвращает конфликт с fitBounds/flyTo, которые выставляют padding как side effect).
 */
export function useMapPadding({ map, isDesktop, hasFeatureSidebar, hasListSidebar }: UseMapPaddingOptions): void {
    useEffect(() => {
        if (!map) return;
        const target = computeMapPadding(isDesktop, hasFeatureSidebar, hasListSidebar);
        const cur = map.getPadding();
        // Если padding уже совпадает (выставлен синхронно через setPadding в flyTo/fitBounds) —
        // не запускаем easeTo, иначе он прервёт идущую анимацию камеры.
        if (cur.top === target.top && cur.right === target.right &&
            cur.bottom === target.bottom && cur.left === target.left) return;
        map.easeTo({ padding: target, duration: 300 });
    }, [map, isDesktop, hasFeatureSidebar, hasListSidebar]);
}
