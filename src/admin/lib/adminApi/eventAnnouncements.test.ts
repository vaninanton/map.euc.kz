import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runManyParsed, invoke, fromTable, selectFn, eqFn, orderFn, db } = vi.hoisted(() => {
    const invoke = vi.fn()
    const orderFn = vi.fn()
    const eqFn = vi.fn(() => ({ order: orderFn }))
    const selectFn = vi.fn(() => ({ eq: eqFn }))
    const fromTable = vi.fn(() => ({ select: selectFn }))
    return {
        runManyParsed: vi.fn(),
        invoke,
        fromTable,
        selectFn,
        eqFn,
        orderFn,
        db: vi.fn(() => ({ from: fromTable, functions: { invoke } })),
    }
})

vi.mock('@/admin/lib/adminApi/query', () => ({
    db,
    runManyParsed,
}))
vi.mock('@/admin/lib/adminApi/parsers', () => ({
    parseAdminEventAnnouncement: (raw: unknown) => raw,
    parseAdminEventParticipant: (raw: unknown) => raw,
    parseAnnounceResult: (raw: unknown) => raw,
}))

import {
    announceEventDate,
    cancelEventDateAnnouncements,
    deleteEventDateAnnouncements,
    editEventDateAnnouncements,
    pinEventAnnouncement,
    listEventAnnouncements,
    listEventParticipants,
} from '@/admin/lib/adminApi/eventAnnouncements'

const DATE_ID = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
    vi.clearAllMocks()
    db.mockReturnValue({ from: fromTable, functions: { invoke } })
    fromTable.mockReturnValue({ select: selectFn })
    selectFn.mockReturnValue({ eq: eqFn })
    eqFn.mockReturnValue({ order: orderFn })
})

describe('announceEventDate', () => {
    it('вызывает Edge Function /announce с телом (pin=false по умолчанию) и парсит результат', async () => {
        invoke.mockResolvedValue({ data: { sent: [], failed: [] }, error: null })

        const result = await announceEventDate(DATE_ID, 'текст', ['dst-1', 'dst-2'])

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/announce', {
            body: { event_date_id: DATE_ID, message_text: 'текст', destination_ids: ['dst-1', 'dst-2'], pin: false },
        })
        expect(result).toEqual({ sent: [], failed: [] })
    })

    it('пробрасывает pin=true в тело запроса', async () => {
        invoke.mockResolvedValue({ data: { sent: [], failed: [] }, error: null })

        await announceEventDate(DATE_ID, 'текст', ['dst-1'], true)

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/announce', {
            body: { event_date_id: DATE_ID, message_text: 'текст', destination_ids: ['dst-1'], pin: true },
        })
    })

    it('бросает ошибку при сбое invoke', async () => {
        invoke.mockResolvedValue({ data: null, error: { message: 'edge down' } })

        await expect(announceEventDate(DATE_ID, 't', ['dst-1'])).rejects.toThrow('edge down')
    })
})

describe('cancelEventDateAnnouncements', () => {
    it('вызывает /announce-cancel и возвращает число отменённых', async () => {
        invoke.mockResolvedValue({ data: { cancelled: 3 }, error: null })

        const result = await cancelEventDateAnnouncements(DATE_ID)

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/announce-cancel', {
            body: { event_date_id: DATE_ID },
        })
        expect(result).toEqual({ cancelled: 3 })
    })

    it('возвращает 0, если поле cancelled отсутствует', async () => {
        invoke.mockResolvedValue({ data: {}, error: null })
        expect(await cancelEventDateAnnouncements(DATE_ID)).toEqual({ cancelled: 0 })
    })

    it('бросает ошибку при сбое invoke', async () => {
        invoke.mockResolvedValue({ data: null, error: { message: 'nope' } })
        await expect(cancelEventDateAnnouncements(DATE_ID)).rejects.toThrow('nope')
    })
})

describe('editEventDateAnnouncements', () => {
    it('вызывает /announce-edit с текстом и возвращает edited/failed', async () => {
        invoke.mockResolvedValue({ data: { edited: 2, failed: [] }, error: null })

        const result = await editEventDateAnnouncements(DATE_ID, 'новый текст')

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/announce-edit', {
            body: { event_date_id: DATE_ID, message_text: 'новый текст' },
        })
        expect(result).toEqual({ edited: 2, failed: [] })
    })

    it('подставляет дефолты, если поля отсутствуют', async () => {
        invoke.mockResolvedValue({ data: {}, error: null })
        expect(await editEventDateAnnouncements(DATE_ID, 't')).toEqual({ edited: 0, failed: [] })
    })

    it('бросает ошибку при сбое invoke', async () => {
        invoke.mockResolvedValue({ data: null, error: { message: 'edit failed' } })
        await expect(editEventDateAnnouncements(DATE_ID, 't')).rejects.toThrow('edit failed')
    })
})

describe('deleteEventDateAnnouncements', () => {
    it('вызывает /announce-delete и возвращает число удалённых', async () => {
        invoke.mockResolvedValue({ data: { deleted: 2 }, error: null })

        const result = await deleteEventDateAnnouncements(DATE_ID)

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/announce-delete', {
            body: { event_date_id: DATE_ID },
        })
        expect(result).toEqual({ deleted: 2 })
    })

    it('возвращает 0, если поле deleted отсутствует', async () => {
        invoke.mockResolvedValue({ data: {}, error: null })
        expect(await deleteEventDateAnnouncements(DATE_ID)).toEqual({ deleted: 0 })
    })

    it('бросает ошибку при сбое invoke', async () => {
        invoke.mockResolvedValue({ data: null, error: { message: 'del failed' } })
        await expect(deleteEventDateAnnouncements(DATE_ID)).rejects.toThrow('del failed')
    })
})

describe('pinEventAnnouncement', () => {
    const ANN_ID = '99999999-2222-3333-4444-555555555555'

    it('вызывает /announce-pin с announcement_id и pin, возвращает pinned', async () => {
        invoke.mockResolvedValue({ data: { ok: true, pinned: true }, error: null })

        const result = await pinEventAnnouncement(ANN_ID, true)

        expect(invoke).toHaveBeenCalledWith('telegram-location-bot/announce-pin', {
            body: { announcement_id: ANN_ID, pin: true },
        })
        expect(result).toEqual({ pinned: true })
    })

    it('pinned=false при откреплении', async () => {
        invoke.mockResolvedValue({ data: { ok: true, pinned: false }, error: null })
        expect(await pinEventAnnouncement(ANN_ID, false)).toEqual({ pinned: false })
    })

    it('бросает ошибку при сбое invoke', async () => {
        invoke.mockResolvedValue({ data: null, error: { message: 'pin failed' } })
        await expect(pinEventAnnouncement(ANN_ID, true)).rejects.toThrow('pin failed')
    })
})

describe('listEventParticipants', () => {
    it('строит select с join telegram_profiles и фильтром по дате', async () => {
        runManyParsed.mockResolvedValue([])

        await listEventParticipants(DATE_ID)

        expect(fromTable).toHaveBeenCalledWith('map_event_participants')
        expect(selectFn).toHaveBeenCalledWith(
            'created_at, telegram_user_id, telegram_profiles(username, first_name, last_name, avatar_url)',
        )
        expect(eqFn).toHaveBeenCalledWith('event_date_id', DATE_ID)
        expect(orderFn).toHaveBeenCalledWith('created_at', { ascending: true })
    })
})

describe('listEventAnnouncements', () => {
    it('фильтрует по дате и сортирует по created_at desc', async () => {
        runManyParsed.mockResolvedValue([])

        await listEventAnnouncements(DATE_ID)

        expect(fromTable).toHaveBeenCalledWith('telegram_outbound_messages')
        expect(eqFn).toHaveBeenCalledWith('event_date_id', DATE_ID)
        expect(orderFn).toHaveBeenCalledWith('created_at', { ascending: false })
    })
})
