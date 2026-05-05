import { useCallback, useMemo, useState } from 'react';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import { LAYER_IDS, LAYER_ID_TO_SOURCE, MAP_ZOOM_FOCUS } from '@/constants';
import { getFeatureBounds, getFeatureCenter } from '@/utils/bounds';
import type { SelectedFeatureState } from '@/utils/selectionOpacity';

const SIDEBAR_DESKTOP_WIDTH = 320;
const SIDEBAR_MOBILE_HEIGHT_RATIO = 0.45;
const FOCUS_PADDING_BASE = 40;

function getRouteFocusPadding(): number | { top: number; right: number; bottom: number; left: number } {
    if (typeof window === 'undefined') return FOCUS_PADDING_BASE;

    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
        return {
            top: FOCUS_PADDING_BASE,
            right: SIDEBAR_DESKTOP_WIDTH + FOCUS_PADDING_BASE,
            bottom: FOCUS_PADDING_BASE,
            left: FOCUS_PADDING_BASE,
        };
    }

    const viewportHeight = window.innerHeight || 0;
    const mobileSidebarHeight = Math.round(viewportHeight * SIDEBAR_MOBILE_HEIGHT_RATIO);
    return {
        top: FOCUS_PADDING_BASE,
        right: FOCUS_PADDING_BASE,
        bottom: mobileSidebarHeight + FOCUS_PADDING_BASE,
        left: FOCUS_PADDING_BASE,
    };
}

type FlyTo = (center: [number, number], zoom: number) => void;
type FlyToBounds = (
    bounds: [[number, number], [number, number]],
    options?: { padding?: number | { top: number; right: number; bottom: number; left: number } }
) => void;

/**
 * Выбор фичи на карте, связка с feature-state и отображение в сайдбаре (в т.ч. актуализация telegram из индекса).
 */
export function useMapFeatureSelection(params: {
    getFeatureById: (layer: LayerKey, id: string) => Feature | null;
    flyTo: FlyTo;
    flyToBounds: FlyToBounds;
}) {
    const { getFeatureById, flyTo, flyToBounds } = params;
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [selectedFeatureState, setSelectedFeatureState] = useState<SelectedFeatureState | null>(null);

    const clearSelection = useCallback(() => {
        setSelectedFeature(null);
        setSelectedFeatureState(null);
    }, []);

    const openFeature = useCallback(
        (feature: Feature, layerKey: LayerKey, lngLat?: [number, number]) => {
            const sourceId = LAYER_ID_TO_SOURCE[LAYER_IDS[layerKey]];
            const id = feature.properties.id;
            setSelectedFeatureState(sourceId ? { sourceId, id } : null);
            setSelectedFeature(feature);
            if (feature.geometry.type === 'LineString') {
                flyToBounds(getFeatureBounds(feature), { padding: getRouteFocusPadding() });
            } else {
                const center = lngLat ?? getFeatureCenter(feature);
                flyTo(center, MAP_ZOOM_FOCUS);
            }
        },
        [flyTo, flyToBounds]
    );

    const handleFeatureSelect = useCallback(
        (feature: Feature, layerKey: LayerKey, lngLat: [number, number]) => {
            openFeature(feature, layerKey, lngLat);
        },
        [openFeature]
    );

    const displaySelectedFeature = useMemo(() => {
        if (!selectedFeature || selectedFeature.properties.type !== 'telegramUser') {
            return selectedFeature;
        }
        const id = selectedFeature.properties.id;
        const idStr = typeof id === 'string' ? id : String(id);
        return getFeatureById('telegramUsers', idStr) ?? selectedFeature;
    }, [selectedFeature, getFeatureById]);

    return {
        selectedFeature,
        selectedFeatureState,
        clearSelection,
        openFeature,
        handleFeatureSelect,
        displaySelectedFeature,
    };
}
