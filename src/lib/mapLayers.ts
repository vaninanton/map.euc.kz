import type { FeatureCollection } from '@/types/geojson';
import { SOURCE_IDS, LAYER_IDS, COLORS } from '@/constants';
import type { Map as MapboxMap, GeoJSONSource, LineLayer, CircleLayer, SymbolLayer } from 'mapbox-gl';

/** Выражения для подсветки по feature-state (hover / selected). */
const stateHighlight = {
  lineWidth: (defaultW: number, hoverW: number, selectedW: number) => [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selectedW,
    ['case', ['boolean', ['feature-state', 'hover'], false], hoverW, defaultW],
  ],
  circleRadius: (defaultR: number, hoverR: number, selectedR: number) => [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selectedR,
    ['case', ['boolean', ['feature-state', 'hover'], false], hoverR, defaultR],
  ],
  circleStrokeWidth: (defaultW: number, hoverW: number, selectedW: number) => [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selectedW,
    ['case', ['boolean', ['feature-state', 'hover'], false], hoverW, defaultW],
  ],
  iconOpacity: (defaultO: number, hoverO: number, selectedO: number) => [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selectedO,
    ['case', ['boolean', ['feature-state', 'hover'], false], hoverO, defaultO],
  ],
  /** Невыбранные — полупрозрачны (selected: true → 1, selected: false → 0.45, нет состояния → 1). */
  opacity: () => [
    'case',
    ['==', ['feature-state', 'selected'], true],
    1,
    ['==', ['feature-state', 'selected'], false],
    0.7,
    1,
  ],
};

function upsertGeoJsonLayer(
  map: MapboxMap,
  sourceId: string,
  layerId: string,
  data: FeatureCollection,
  paint: Record<string, unknown>
): void {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data, promoteId: 'id' });
  } else {
    (map.getSource(sourceId) as GeoJSONSource).setData(data);
  }
  if (!map.getLayer(layerId)) {
    map.addLayer({ id: layerId, type: 'line', source: sourceId, paint } as LineLayer);
  }
}

const PLUG_ICON_ID = 'plug-icon';

/** Жёлтая евро-розетка: квадратная иконка, внутри круглая розетка с контактами заземления. */
const PLUG_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <filter id="socketShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect x="2" y="2" width="28" height="28" rx="4" fill="#eab308" stroke="#a16207" stroke-width="1.5" stroke-linejoin="round" filter="url(#socketShadow)"/>
  <circle cx="16" cy="16" r="10" fill="#facc15" stroke="#a16207" stroke-width="1.2"/>
  <circle cx="12" cy="16" r="2.8" fill="#1c1917"/>
  <circle cx="20" cy="16" r="2.8" fill="#1c1917"/>
  <rect x="14" y="7" width="4" height="1.8" rx="0.5" fill="#1c1917"/>
  <rect x="14" y="23.2" width="4" height="1.8" rx="0.5" fill="#1c1917"/>
</svg>`;

function ensurePlugImage(map: MapboxMap, callback: () => void): void {
  if (map.hasImage(PLUG_ICON_ID)) {
    callback();
    return;
  }
  const img = new Image();
  img.onload = () => {
    if (!map.hasImage(PLUG_ICON_ID)) map.addImage(PLUG_ICON_ID, img, { pixelRatio: 2 });
    callback();
  };
  img.onerror = () => {
    callback();
  };
  img.src = 'data:image/svg+xml,' + encodeURIComponent(PLUG_ICON_SVG);
}

export interface AddLayersOptions {
  pointsGeo: FeatureCollection | null;
  routesGeo: FeatureCollection | null;
  bikeLanesGeo: FeatureCollection | null;
  socketsVisible: boolean;
}

/**
 * Добавляет или обновляет источники и слои на карте Mapbox.
 * Вызывать после загрузки стиля (style.load или после load).
 */
export function addLayersToMap(map: MapboxMap, options: AddLayersOptions): void {
  const { pointsGeo, routesGeo, bikeLanesGeo, socketsVisible } = options;
  // Стиль может быть ещё не загружен (mapbox-gl)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getStyle() может быть undefined до load
  if (map.getStyle() === undefined) return;

  // Сначала маршруты и велодорожки (ниже по z-index)
  if (routesGeo?.features.length) {
    upsertGeoJsonLayer(map, SOURCE_IDS.routes, LAYER_IDS.routes, routesGeo, {
      'line-color': COLORS.route,
      'line-width': stateHighlight.lineWidth(2.5, 3.5, 2.5),
      'line-opacity': stateHighlight.opacity(),
    });
  }
  if (bikeLanesGeo?.features.length) {
    upsertGeoJsonLayer(map, SOURCE_IDS.bikeLanes, LAYER_IDS.bikeLanes, bikeLanesGeo, {
      'line-color': COLORS.bikeLane,
      'line-width': stateHighlight.lineWidth(2.5, 3.5, 2.5),
      'line-dasharray': [2, 1.5],
      'line-opacity': stateHighlight.opacity(),
    });
  }

  // Затем точки и розетки (выше по z-index)
  if (pointsGeo?.features.length) {
    if (!map.getSource(SOURCE_IDS.points)) {
      map.addSource(SOURCE_IDS.points, { type: 'geojson', data: pointsGeo, promoteId: 'id' });
    } else {
      (map.getSource(SOURCE_IDS.points) as GeoJSONSource).setData(pointsGeo);
    }
    if (!map.getLayer(LAYER_IDS.points)) {
      map.addLayer({
        id: LAYER_IDS.points,
        type: 'circle',
        source: SOURCE_IDS.points,
        filter: ['==', ['get', 'type'], 'point'],
        paint: {
          'circle-radius': stateHighlight.circleRadius(8, 10, 13),
          'circle-color': COLORS.point,
          'circle-stroke-width': stateHighlight.circleStrokeWidth(2, 2.5, 4),
          'circle-stroke-color': '#fff',
          'circle-opacity': stateHighlight.opacity(),
        },
      } as unknown as CircleLayer);
    }
    if (map.getLayer(LAYER_IDS.points)) map.moveLayer(LAYER_IDS.points);
    if (!map.getLayer(LAYER_IDS.sockets)) {
      ensurePlugImage(map, () => {
        if (map.getLayer(LAYER_IDS.sockets)) return;
        if (!map.getSource(SOURCE_IDS.points)) return;
        map.addLayer({
          id: LAYER_IDS.sockets,
          type: 'symbol',
          source: SOURCE_IDS.points,
          filter: ['==', ['get', 'type'], 'socket'],
          layout: {
            'icon-image': PLUG_ICON_ID,
            // icon-size — layout, feature-state в нём недоступен; подсветка через paint (icon-opacity)
            'icon-size': 1.1,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-anchor': 'bottom',
            visibility: socketsVisible ? 'visible' : 'none',
          },
          paint: {
            'icon-opacity': [
              'case',
              ['==', ['feature-state', 'selected'], true],
              1,
              ['==', ['feature-state', 'selected'], false],
              0.45,
              ['case', ['boolean', ['feature-state', 'hover'], false], 1.2, 1],
            ],
          },
        } as unknown as SymbolLayer);
        if (map.getLayer(LAYER_IDS.points)) map.moveLayer(LAYER_IDS.points);
        if (map.getLayer(LAYER_IDS.sockets)) map.moveLayer(LAYER_IDS.sockets);
      });
    } else {
      if (map.getLayer(LAYER_IDS.sockets)) map.moveLayer(LAYER_IDS.sockets);
    }
  }
}
