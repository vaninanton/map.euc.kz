import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

interface UseMapPaddingOptions {
    map: MapboxMap | null;
    isDesktop: boolean;
    /** FeatureSidebar: mobile bottom 45vh, desktop right 320px */
    hasFeatureSidebar: boolean;
    /** RouteListSidebar / PointListSidebar: mobile bottom 80vh, desktop left 360px */
    hasListSidebar: boolean;
}

/**
 * Подстраивает видимую область карты под открытые панели через map.easeTo({ padding }).
 * Первое применение — мгновенное (duration: 0), чтобы fitBounds при deep link
 * уже видел актуальный padding. Последующие изменения — анимированные (duration: 300).
 */
export function useMapPadding({ map, isDesktop, hasFeatureSidebar, hasListSidebar }: UseMapPaddingOptions): void {
    const isFirstRef = useRef(true);

    useEffect(() => {
        if (!map) return;

        let bottom = 0;
        let right = 0;
        let left = 0;

        if (isDesktop) {
            if (hasFeatureSidebar) right = 320;
            if (hasListSidebar) left = 360;
        } else {
            if (hasFeatureSidebar) bottom = Math.round(window.innerHeight * 0.45);
            else if (hasListSidebar) bottom = Math.round(window.innerHeight * 0.80);
        }

        if (isFirstRef.current) {
            // Синхронно — чтобы fitBounds при deep link уже видел актуальный padding
            isFirstRef.current = false;
            map.setPadding({ top: 0, right, bottom, left });
        } else {
            map.easeTo({ padding: { top: 0, right, bottom, left }, duration: 300 });
        }
    }, [map, isDesktop, hasFeatureSidebar, hasListSidebar]);
}
