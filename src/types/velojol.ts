/**
 * Запись из `src/data/almaty.json` — датасета велодорожек Алматы с velojol.kz.
 * Файл пересобирается скриптом `scripts/fetch-velojol-bike-lanes.js`
 * (страница velojol.kz/city/almaty, объект `window.bikelanesData`).
 */
export interface VelojolSegment {
    /** Id велодорожки в velojol.kz — попадает в deep-link `/m/bikelane/:id`. */
    id: number
    name: string
    /** Машинный тип полосы: `separated`, `shared`, `lane`, `bollards`. */
    laneType: string
    /** Русская подпись типа полосы, напр. «Обособленная велодорожка». */
    laneTypeLabel: string
    /** Длина в километрах (из velojol; при отсутствии — посчитана скриптом). */
    distance: number
    description?: string
    /** Оценка покрытия 1–5; отсутствует, если в velojol не указана. */
    quality?: number
    /** Русская подпись оценки покрытия, напр. «Хорошо». */
    qualityLabel?: string
    coordinates: [number, number][]
}
