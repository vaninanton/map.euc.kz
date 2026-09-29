/**
 * Запись из `src/data/almaty.json` — велодорожек Алматы из OpenStreetMap.
 * Файл пересобирается скриптом `scripts/fetch-osm-bike-lanes.js` (Overpass API).
 */
export interface BikeLaneSegment {
    /** Наименьший id way OSM в склеенной линии — попадает в deep-link `/m/bikelane/:id`. */
    id: number
    name: string
    /** Машинный тип полосы: `separated`, `shared`, `lane`. */
    laneType: string
    /** Русская подпись типа полосы, напр. «Обособленная велодорожка». */
    laneTypeLabel: string
    /** Длина в километрах, посчитана скриптом по геометрии. */
    distance: number
    description?: string
    coordinates: [number, number][]
}
