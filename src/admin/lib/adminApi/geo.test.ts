import { describe, it, expect, vi } from 'vitest'
import { buildRiderTracks } from './geo'
import type { TelegramLocationRow } from '@/types/supabase'

// db() вызывается только в fetchTelegramLocations (network), buildRiderTracks — чистая функция
vi.mock('./query', () => ({ db: vi.fn(), runManyRaw: vi.fn() }))

function makeRow(overrides: Partial<TelegramLocationRow> = {}): TelegramLocationRow {
    return {
        id: '1',
        created_at: '2024-06-01T10:00:00.000Z',
        chat_id: 0,
        chat_title: null,
        telegram_user_id: 42,
        username: null,
        first_name: 'Иван',
        last_name: 'Петров',
        avatar_url: null,
        longitude: 76.9,
        latitude: 43.2,
        location_accuracy_meters: null,
        ...overrides,
    }
}

describe('buildRiderTracks', () => {
    it('возвращает пустой массив для пустого ввода', () => {
        expect(buildRiderTracks([])).toEqual([])
    })

    it('группирует локации по telegram_user_id', () => {
        const rows = [
            makeRow({ telegram_user_id: 1, created_at: '2024-06-01T10:00:00Z' }),
            makeRow({ telegram_user_id: 2, created_at: '2024-06-01T11:00:00Z', first_name: 'Анна', last_name: null }),
            makeRow({ telegram_user_id: 1, created_at: '2024-06-01T12:00:00Z' }),
        ]
        const tracks = buildRiderTracks(rows)
        expect(tracks).toHaveLength(2)
    })

    it('сортирует локации внутри трека по времени по возрастанию', () => {
        const rows = [
            makeRow({ telegram_user_id: 1, created_at: '2024-06-01T12:00:00Z' }),
            makeRow({ telegram_user_id: 1, created_at: '2024-06-01T10:00:00Z' }),
        ]
        const [track] = buildRiderTracks(rows)
        expect(track.locations[0].created_at).toBe('2024-06-01T10:00:00Z')
        expect(track.locations[1].created_at).toBe('2024-06-01T12:00:00Z')
    })

    it('сортирует треки по lastSeenAt по убыванию', () => {
        const rows = [
            makeRow({ telegram_user_id: 1, created_at: '2024-06-01T10:00:00Z' }),
            makeRow({ telegram_user_id: 2, created_at: '2024-06-02T10:00:00Z', first_name: 'Анна', last_name: null }),
        ]
        const tracks = buildRiderTracks(rows)
        expect(tracks[0].riderId).toBe(2)
    })

    it('displayName = "Имя Фамилия" если есть оба поля', () => {
        const [track] = buildRiderTracks([makeRow({ first_name: 'Иван', last_name: 'Петров' })])
        expect(track.displayName).toBe('Иван Петров')
    })

    it('displayName = "@username" если нет имени', () => {
        const [track] = buildRiderTracks([makeRow({ first_name: null, last_name: null, username: 'vanya' })])
        expect(track.displayName).toBe('@vanya')
    })

    it('displayName = "ID N" если нет имени и username', () => {
        const [track] = buildRiderTracks([
            makeRow({ first_name: null, last_name: null, username: null, telegram_user_id: 99 }),
        ])
        expect(track.displayName).toBe('ID 99')
    })

    it('назначает цвет из палитры по riderId % длина', () => {
        const [track] = buildRiderTracks([makeRow({ telegram_user_id: 0 })])
        expect(typeof track.color).toBe('string')
        expect(track.color).toMatch(/^#/)
    })
})
