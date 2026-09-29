import { describe, it, expect } from 'vitest'
import { bikeLanesToFeatureCollection } from './bikeLanesToGeojson'
import type { BikeLaneSegment } from '@/types/bikeLane'

function makeSegment(overrides: Partial<BikeLaneSegment> = {}): BikeLaneSegment {
    return {
        id: 58,
        name: 'улица Манаса',
        laneType: 'separated',
        laneTypeLabel: 'Обособленная велодорожка',
        distance: 0.42,
        description: 'Двухполосная велосипедная дорожка с разметкой',
        coordinates: [
            [76.908566, 43.239716],
            [76.909093, 43.235942],
        ],
        ...overrides,
    }
}

describe('bikeLanesToFeatureCollection', () => {
    it('превращает сегменты в LineString-фичи велодорожек', () => {
        const result = bikeLanesToFeatureCollection([makeSegment()])

        expect(result.type).toBe('FeatureCollection')
        expect(result.features).toHaveLength(1)
        const [feature] = result.features
        expect(feature.geometry).toEqual({
            type: 'LineString',
            coordinates: [
                [76.908566, 43.239716],
                [76.909093, 43.235942],
            ],
        })
        expect(feature.properties).toEqual({
            id: '58',
            name: 'улица Манаса',
            description: 'Двухполосная велосипедная дорожка с разметкой',
            type: 'bikeLane',
            distance: 0.42,
            laneTypeLabel: 'Обособленная велодорожка',
        })
    })

    it('приводит числовой id к строке — под promoteId и deep-link /m/bikelane/:id', () => {
        const [feature] = bikeLanesToFeatureCollection([makeSegment({ id: 7589 })]).features
        expect(feature.properties.id).toBe('7589')
    })

    it('без описания кладёт null, чтобы карточка не показывала пустой абзац', () => {
        const [feature] = bikeLanesToFeatureCollection([makeSegment({ description: undefined })]).features
        expect(feature.properties.description).toBeNull()
    })

    it('отбрасывает сегменты с битой геометрией', () => {
        const segments = [
            makeSegment({ id: 1, coordinates: [] }),
            makeSegment({ id: 2, coordinates: [[76.9, 43.2]] }),
            makeSegment({
                id: 3,
                coordinates: [
                    [76.9, 43.2],
                    [76.95, 43.25],
                ],
            }),
        ]
        const result = bikeLanesToFeatureCollection(segments)
        expect(result.features.map((feature) => feature.properties.id)).toEqual(['3'])
    })

    it('на пустом датасете возвращает пустую коллекцию', () => {
        expect(bikeLanesToFeatureCollection([])).toEqual({ type: 'FeatureCollection', features: [] })
    })
})
