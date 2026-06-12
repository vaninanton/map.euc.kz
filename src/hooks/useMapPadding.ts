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

/**
 * Подстраивает видимую область карты под открытые панели через map.easeTo({ padding }).
 * Карта не уходит под оверлей — центр остаётся в видимой зоне.
 */
export function useMapPadding({ map, isDesktop, hasFeatureSidebar, hasListSidebar }: UseMapPaddingOptions): void {
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

        map.easeTo({ padding: { top: 0, right, bottom, left }, duration: 300 });
    }, [map, isDesktop, hasFeatureSidebar, hasListSidebar]);
}
