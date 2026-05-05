import type { Map as MapboxMap } from 'mapbox-gl';
import { LAYER_IDS, type LayerKey } from '@/constants';
import type { LayerVisibility } from '@/constants/layerVisibility';

/**
 * Слои Mapbox, для которых выставляется visibility по ключу UI.
 * У telegram два слоя (треки + маркеры) — одна кнопка.
 */
export const LAYER_KEY_TO_MAP_LAYER_IDS: Record<LayerKey, readonly string[]> = {
    points: [LAYER_IDS.points],
    sockets: [LAYER_IDS.sockets],
    routes: [LAYER_IDS.routes],
    bikeLanes: [LAYER_IDS.bikeLanes],
    telegramUsers: [LAYER_IDS.telegramUsers, LAYER_IDS.telegramTracks],
};

export function applyVisibilityToMapLayers(map: MapboxMap, visibility: LayerVisibility): void {
    (Object.keys(LAYER_KEY_TO_MAP_LAYER_IDS) as LayerKey[]).forEach((key) => {
        const visible = visibility[key];
        for (const layerId of LAYER_KEY_TO_MAP_LAYER_IDS[key]) {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            }
        }
    });
}
