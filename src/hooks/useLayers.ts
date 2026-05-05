import { useCallback } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { addLayersToMap as addLayersToMapImpl } from '@/lib/mapLayers';
import { applyVisibilityToMapLayers } from '@/constants/mapLayerRegistry';
import type { LayerVisibility } from '@/constants/layerVisibility';
import { useLayerVisibilityStore } from '@/hooks/useLayerVisibilityStore';
import { useMapData } from '@/hooks/useMapData';

export type { LayerKey } from '@/constants';
export type { LayerVisibility };

export function useLayers() {
    const {
        pointsGeo,
        routesGeo,
        bikeLanesGeo,
        telegramUsersGeo,
        loading,
        errorMessage,
        emptyMessage,
        getFeatureById,
    } = useMapData();

    const { visibility, toggleLayer, setLayerVisibility } = useLayerVisibilityStore();

    const addLayersToMap = useCallback(
        (map: MapboxMap) => {
            addLayersToMapImpl(map, {
                pointsGeo,
                routesGeo,
                bikeLanesGeo,
                telegramUsersGeo,
                visibility,
            });
        },
        [pointsGeo, routesGeo, bikeLanesGeo, telegramUsersGeo, visibility]
    );

    const applyVisibility = useCallback(
        (map: MapboxMap | null) => {
            if (!map) return;
            applyVisibilityToMapLayers(map, visibility);
        },
        [visibility]
    );

    return {
        pointsGeo,
        routesGeo,
        bikeLanesGeo,
        telegramUsersGeo,
        visibility,
        loading,
        errorMessage,
        emptyMessage,
        toggleLayer,
        setLayerVisibility,
        addLayersToMap,
        applyVisibility,
        getFeatureById,
    };
}
