import { useCallback, useMemo, useState } from 'react';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import { LAYER_IDS, LAYER_ID_TO_SOURCE, MAP_ZOOM_FOCUS } from '@/constants';
import { getFeatureBounds, getFeatureCenter } from '@/utils/bounds';
import type { SelectedFeatureState } from '@/utils/selectionOpacity';

// useMapPadding устанавливает map.padding под открытые панели,
// поэтому fitBounds учитывает его автоматически — здесь только базовый отступ.
const FOCUS_PADDING_BASE = 40;

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

    /** Полностью очищает выбранную фичу и её feature-state. */
    const clearSelection = useCallback(() => {
        setSelectedFeature(null);
        setSelectedFeatureState(null);
    }, []);

    /**
     * Открывает фичу: ставит selected-state и фокусирует карту
     * (по bounds для линий, по центру для точек).
     */
    const openFeature = useCallback(
        (feature: Feature, layerKey: LayerKey, lngLat?: [number, number]) => {
            const sourceId = LAYER_ID_TO_SOURCE[LAYER_IDS[layerKey]];
            const id = feature.properties.id;
            setSelectedFeatureState(sourceId ? { sourceId, id } : null);
            setSelectedFeature(feature);
            if (feature.geometry.type === 'LineString') {
                flyToBounds(getFeatureBounds(feature), { padding: FOCUS_PADDING_BASE });
            } else {
                const center = lngLat ?? getFeatureCenter(feature);
                flyTo(center, MAP_ZOOM_FOCUS);
            }
        },
        [flyTo, flyToBounds]
    );

    /** Адаптер для click-хука с фиксированной сигнатурой колбэка. */
    const handleFeatureSelect = useCallback(
        (feature: Feature, layerKey: LayerKey, lngLat: [number, number]) => {
            openFeature(feature, layerKey, lngLat);
        },
        [openFeature]
    );

    /** Для Telegram-фич берёт актуальные данные из индекса (аватар, имя и т.д.). */
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
