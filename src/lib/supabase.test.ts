import { afterEach, describe, expect, it, vi } from 'vitest'

interface QueryCall {
    table: string
    method: string
    args: unknown[]
}

function makeThenableQuery(table: string, calls: QueryCall[], resolveRange: (from: number, to: number) => unknown) {
    return {
        select(...args: unknown[]) {
            calls.push({ table, method: 'select', args })
            return this
        },
        eq(...args: unknown[]) {
            calls.push({ table, method: 'eq', args })
            return this
        },
        gte(...args: unknown[]) {
            calls.push({ table, method: 'gte', args })
            return this
        },
        or(...args: unknown[]) {
            calls.push({ table, method: 'or', args })
            return this
        },
        order(...args: unknown[]) {
            calls.push({ table, method: 'order', args })
            return this
        },
        range(from: number, to: number) {
            calls.push({ table, method: 'range', args: [from, to] })
            return Promise.resolve(resolveRange(from, to))
        },
        insert(...args: unknown[]) {
            calls.push({ table, method: 'insert', args })
            return Promise.resolve(resolveRange(0, 0))
        },
        then<TResult1 = unknown, TResult2 = never>(
            onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
            return Promise.resolve(resolveRange(0, 0)).then(onfulfilled, onrejected)
        },
    }
}

describe('lib/supabase data access', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.resetModules()
        vi.unstubAllEnvs()
        vi.clearAllMocks()
        vi.doUnmock('@supabase/supabase-js')
    })

    it('fetchTelegramLocations paginates, applies TTL/accuracy filters, merges profiles, and strips unsafe avatar URLs', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
        vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
        vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key')
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', '30')
        vi.stubEnv('VITE_TELEGRAM_MAX_ACCURACY_METERS', '25')

        const calls: QueryCall[] = []
        const createClient = vi.fn(() => ({
            from: (table: string) =>
                makeThenableQuery(table, calls, (from) => {
                    if (table === 'telegram_locations') {
                        if (from === 0) return { data: Array.from({ length: 1000 }, () => ({ invalid: true })), error: null }
                        return {
                            data: [
                                {
                                    id: 1001,
                                    created_at: '2026-05-07T11:45:00Z',
                                    chat_id: -1,
                                    chat_title: 'EUC Almaty',
                                    telegram_user_id: 77,
                                    username: 'stale',
                                    first_name: 'Old',
                                    last_name: null,
                                    avatar_url: 'https://api.telegram.org/file/botSECRET/avatar.jpg',
                                    longitude: 76.95,
                                    latitude: 43.24,
                                    location_accuracy_meters: 10,
                                },
                                {
                                    id: 1002,
                                    created_at: '2026-05-07T11:50:00Z',
                                    chat_id: -1,
                                    telegram_user_id: 88,
                                    longitude: 76.96,
                                    latitude: 43.25,
                                    location_accuracy_meters: null,
                                },
                            ],
                            error: null,
                        }
                    }
                    if (from === 0) {
                        return {
                            data: [
                                {
                                    telegram_user_id: 77,
                                    username: 'fresh',
                                    first_name: 'New',
                                    last_name: 'Name',
                                    avatar_url: 'https://project.supabase.co/storage/v1/object/public/avatars/77.jpg',
                                    updated_at: '2026-05-07T11:59:00Z',
                                },
                                {
                                    telegram_user_id: 88,
                                    username: null,
                                    first_name: 'Unsafe',
                                    last_name: null,
                                    avatar_url: 'https://api.telegram.org/file/botSECRET/avatar.jpg',
                                    updated_at: '2026-05-07T11:59:00Z',
                                },
                            ],
                            error: null,
                        }
                    }
                    return { data: [], error: null }
                }),
        }))
        vi.doMock('@supabase/supabase-js', () => ({ createClient }))

        const { fetchTelegramLocations } = await import('@/lib/supabase')
        const rows = await fetchTelegramLocations()

        expect(createClient).toHaveBeenCalledWith('https://project.supabase.co', 'anon-key')
        expect(calls).toContainEqual({
            table: 'telegram_locations',
            method: 'gte',
            args: ['created_at', '2026-05-07T11:30:00.000Z'],
        })
        expect(calls).toContainEqual({
            table: 'telegram_locations',
            method: 'or',
            args: ['location_accuracy_meters.is.null,location_accuracy_meters.lte.25'],
        })
        expect(calls.filter((call) => call.table === 'telegram_locations' && call.method === 'range')).toEqual([
            { table: 'telegram_locations', method: 'range', args: [0, 999] },
            { table: 'telegram_locations', method: 'range', args: [1000, 1999] },
        ])
        expect(rows).toHaveLength(2)
        expect(rows[0]).toMatchObject({
            id: '1001',
            telegram_user_id: 77,
            username: 'fresh',
            first_name: 'New',
            avatar_url: 'https://project.supabase.co/storage/v1/object/public/avatars/77.jpg',
        })
        expect(rows[1]).toMatchObject({
            id: '1002',
            telegram_user_id: 88,
            avatar_url: null,
        })
    })

    it('createMapPointDraft forces socket submissions to non-meeting and reports insert errors', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
        vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key')
        const calls: QueryCall[] = []
        const createClient = vi.fn(() => ({
            from: (table: string) =>
                makeThenableQuery(table, calls, () => ({
                    data: null,
                    error: { message: 'RLS denied' },
                })),
        }))
        vi.doMock('@supabase/supabase-js', () => ({ createClient }))

        const { createMapPointDraft } = await import('@/lib/supabase')

        await expect(
            createMapPointDraft({
                type: 'socket',
                title: 'Charger',
                description: null,
                coordinates: [76.95, 43.24],
                flag_is_meeting: true,
            }),
        ).rejects.toThrow('Не удалось отправить заявку')
        expect(calls).toContainEqual({
            table: 'map_points_submissions',
            method: 'insert',
            args: [
                {
                    type: 'socket',
                    title: 'Charger',
                    description: null,
                    coordinates: [76.95, 43.24],
                    flag_is_meeting: false,
                },
            ],
        })
    })
})
