import { describe, expect, it } from 'vitest';
import { SOURCE_IDS } from '@/constants';
import {
  DIM_OPACITY,
  buildSelectionOpacityExpression,
  type SelectedFeatureState,
} from '@/utils/selectionOpacity';

describe('selectionOpacity smoke', () => {
  it('не меняет прозрачность без выбранной фичи', () => {
    const expr = buildSelectionOpacityExpression(SOURCE_IDS.points, null);
    expect(expr).toBe(1);
  });

  it('затемняет остальные элементы при выборе', () => {
    const selected: SelectedFeatureState = { sourceId: SOURCE_IDS.points, id: 'p-1' };
    const otherSourceExpr = buildSelectionOpacityExpression(SOURCE_IDS.routes, selected);
    expect(otherSourceExpr).toBe(DIM_OPACITY);
  });

  it('оставляет выбранный элемент непрозрачным и снижает остальные в том же слое', () => {
    const selected: SelectedFeatureState = { sourceId: SOURCE_IDS.points, id: 'p-1' };
    const sameSourceExpr = buildSelectionOpacityExpression(SOURCE_IDS.points, selected);

    expect(sameSourceExpr).toEqual([
      'case',
      ['==', ['id'], 'p-1'],
      1,
      DIM_OPACITY,
    ]);
  });
});
