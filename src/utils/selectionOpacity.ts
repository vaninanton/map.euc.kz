import { LAYER_IDS, LAYER_ID_TO_SOURCE } from '@/constants';
import type { ExpressionSpecification, Map as MapboxMap } from 'mapbox-gl';

export interface SelectedFeatureState {
  sourceId: string;
  id: string;
}

export const DIM_OPACITY = 0.4;

function getSelectedTelegramUserId(selected: SelectedFeatureState | null): number | null {
  if (!selected) return null;
  const match = /^telegram-(?:user|track)-(\d+)$/.exec(selected.id);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildTelegramSelectionExpression(selected: SelectedFeatureState): ExpressionSpecification {
  const selectedTelegramUserId = getSelectedTelegramUserId(selected);
  if (selectedTelegramUserId !== null) {
    return [
      'case',
      ['==', ['get', 'telegramUserId'], selectedTelegramUserId],
      1,
      DIM_OPACITY,
    ];
  }
  return [
    'case',
    ['==', ['id'], selected.id],
    1,
    DIM_OPACITY,
  ];
}

export function buildSelectionOpacityExpression(
  sourceId: string,
  selected: SelectedFeatureState | null
): number | ExpressionSpecification {
  if (!selected) return 1;
  if (selected.sourceId !== sourceId) return DIM_OPACITY;
  if (sourceId === LAYER_ID_TO_SOURCE[LAYER_IDS.telegramUsers]) {
    return buildTelegramSelectionExpression(selected);
  }
  return [
    'case',
    ['==', ['id'], selected.id],
    1,
    DIM_OPACITY,
  ];
}

export function applySelectionOpacityById(
  map: MapboxMap | null,
  selected: SelectedFeatureState | null
) {
  if (!map) return;

  if (map.getLayer(LAYER_IDS.points)) {
    map.setPaintProperty(
      LAYER_IDS.points,
      'circle-opacity',
      buildSelectionOpacityExpression(LAYER_ID_TO_SOURCE[LAYER_IDS.points], selected)
    );
  }
  if (map.getLayer(LAYER_IDS.sockets)) {
    map.setPaintProperty(
      LAYER_IDS.sockets,
      'icon-opacity',
      buildSelectionOpacityExpression(LAYER_ID_TO_SOURCE[LAYER_IDS.sockets], selected)
    );
  }
  if (map.getLayer(LAYER_IDS.routes)) {
    map.setPaintProperty(
      LAYER_IDS.routes,
      'line-opacity',
      buildSelectionOpacityExpression(LAYER_ID_TO_SOURCE[LAYER_IDS.routes], selected)
    );
  }
  if (map.getLayer(LAYER_IDS.bikeLanes)) {
    map.setPaintProperty(
      LAYER_IDS.bikeLanes,
      'line-opacity',
      buildSelectionOpacityExpression(LAYER_ID_TO_SOURCE[LAYER_IDS.bikeLanes], selected)
    );
  }
  if (map.getLayer(LAYER_IDS.telegramTracks)) {
    map.setPaintProperty(
      LAYER_IDS.telegramTracks,
      'line-opacity',
      buildSelectionOpacityExpression(LAYER_ID_TO_SOURCE[LAYER_IDS.telegramTracks], selected)
    );
  }
  if (map.getLayer(LAYER_IDS.telegramUsers)) {
    const telegramSourceId = LAYER_ID_TO_SOURCE[LAYER_IDS.telegramUsers];
    const telegramSelectedExpression =
      selected && selected.sourceId === telegramSourceId
        ? buildTelegramSelectionExpression(selected)
        : null;
    map.setPaintProperty(
      LAYER_IDS.telegramUsers,
      'circle-opacity',
      telegramSelectedExpression
        ? telegramSelectedExpression
        : [
            'interpolate',
            ['linear'],
            ['get', 'ageMinutes'],
            0,
            1,
            10,
            0.25,
          ]
    );
  }
}
