/** Элемент из API velojol.kz/static/data/cities/almaty.json */
export interface VelojolSegment {
  id: string;
  name: string;
  distance?: number;
  safetyLevel?: number;
  description?: string;
  coordinates: [number, number][];
  source?: string;
  date?: string;
}
