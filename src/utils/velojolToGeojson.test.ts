import { describe, it, expect } from 'vitest'
import { velojolToFeatureCollection } from './velojolToGeojson'
import type { VelojolSegment } from '@/types/velojol'

function makeSegment(overrides: Partial<VelojolSegment> = {}): VelojolSegment {
    return {
        id: 58,
        name: 'Манас көшесі',
        laneType: 'separated',
        laneTypeLabel: 'Обособленная велодорожка',
        distance: 0.42,
        description: 'Двухполосная велосипедная дорожка с разметкой',
        quality: 3,
        qualityLabel: 'Средне',
        coordinates: [
            [76.908566, 43.239716],
            [76.909093, 43.235942],
        ],
        ...overrides,
    }
}

describe('velojolToFeatureCollection', () => {
    it('превращает сегменты в LineString-фичи велодорожек', () => {
        const result = velojolToFeatureCollection([makeSegment()])

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
            name: 'Манас көшесі',
            description: 'Двухполосная велосипедная дорожка с разметкой',
            type: 'bikeLane',
            distance: 0.42,
            laneTypeLabel: 'Обособленная велодорожка',
            quality: 3,
            qualityLabel: 'Средне',
        })
    })

    it('приводит числовой id к строке — под promoteId и deep-link /m/bikelane/:id', () => {
        const [feature] = velojolToFeatureCollection([makeSegment({ id: 7589 })]).features
        expect(feature.properties.id).toBe('7589')
    })

    it('без описания кладёт null, чтобы карточка не показывала пустой абзац', () => {
        const [feature] = velojolToFeatureCollection([makeSegment({ description: undefined })]).features
        expect(feature.properties.description).toBeNull()
    })

    it('не проставляет оценку покрытия, если её нет в velojol', () => {
        const [feature] = velojolToFeatureCollection([
            makeSegment({ quality: undefined, qualityLabel: undefined }),
        ]).features
        expect(feature.properties).not.toHaveProperty('quality')
        expect(feature.properties).not.toHaveProperty('qualityLabel')
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
        const result = velojolToFeatureCollection(segments)
        expect(result.features.map((feature) => feature.properties.id)).toEqual(['3'])
    })

    it('на пустом датасете возвращает пустую коллекцию', () => {
        expect(velojolToFeatureCollection([])).toEqual({ type: 'FeatureCollection', features: [] })
    })
})
