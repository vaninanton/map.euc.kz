import { useCallback, useMemo, useState } from 'react';
import type { Feature } from '@/types/geojson';
import type { LayerKey } from '@/constants';
import { LAYER_IDS, LAYER_ID_TO_SOURCE, MAP_ZOOM_FOCUS } from '@/constants';
import { getFeatureBounds, getFeatureCenter } from '@/utils/bounds';
import type { SelectedFeatureState } from '@/utils/selectionOpacity';
import { computeMapPadding } from '@/hooks/useMapPadding';

type PaddingRect = { top: number; right: number; bottom: number; left: number };

/**
 * Возвращает padding точно совпадающий с тем, что выставляет useMapPadding при hasFeatureSidebar=true.
 * Передаём явно в fitBounds/flyTo — Mapbox применит его как глобальный side effect,
 * и useMapPadding при ре-рендере увидит совпадение и не запустит конфликтующий easeTo.
 */
function getSidebarPadding(): PaddingRect {
    if (typeof window === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    return computeMapPadding(isDesktop, true, false);
}

type FlyTo = (center: [number, number], zoom: number, padding?: PaddingRect) => void;
type FlyToBounds = (
    bounds: [[number, number], [number, number]],
    options?: { padding?: number | PaddingRect; maxZoom?: number }
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
     * Открывает фичу: ставит selected-state и фокусирует карту.
     * Передаём итоговый padding (sidebar + base) явно в fitBounds/flyTo —
     * Mapbox применяет его как глобальный side effect, и useMapPadding при ре-рендере
     * увидит совпадение с текущим map.padding и не запустит конфликтующий easeTo.
     */
    const openFeature = useCallback(
        (feature: Feature, layerKey: LayerKey, lngLat?: [number, number]) => {
            const sourceId = LAYER_ID_TO_SOURCE[LAYER_IDS[layerKey]];
            const id = feature.properties.id;
            // Сначала двигаем камеру — setPadding внутри flyTo/flyToBounds должен сработать
            // ДО того как React применит новый state и запустит useMapPadding эффект.
            // Если поставить setState первыми — React ре-рендерит синхронно (в React 18 batching),
            // useMapPadding видит старый map.getPadding() и запускает конкурирующий easeTo.
            if (feature.geometry.type === 'LineString') {
                flyToBounds(getFeatureBounds(feature), { padding: getSidebarPadding() });
            } else {
                const center = lngLat ?? getFeatureCenter(feature);
                flyTo(center, MAP_ZOOM_FOCUS, getSidebarPadding());
            }
            setSelectedFeatureState(sourceId ? { sourceId, id } : null);
            setSelectedFeature(feature);
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
