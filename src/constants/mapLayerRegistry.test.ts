import { describe, expect, it } from 'vitest'
import { LAYER_IDS } from '@/constants'
import { LAYER_KEY_TO_MAP_LAYER_IDS } from '@/constants/mapLayerRegistry'

describe('mapLayerRegistry', () => {
    it('telegramUsers управляет двумя слоями Mapbox', () => {
        expect(LAYER_KEY_TO_MAP_LAYER_IDS.telegramUsers).toContain(LAYER_IDS.telegramTracks)
        expect(LAYER_KEY_TO_MAP_LAYER_IDS.telegramUsers).toContain(LAYER_IDS.telegramUsers)
    })
})
