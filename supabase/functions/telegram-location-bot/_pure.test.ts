import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
    buildAnnouncementHeader,
    buildAnnouncementText,
    buildCancelledAnnouncementText,
    buildLiveLocationEphemeralText,
    buildNewsText,
    buildRsvpEphemeralText,
    buildRsvpKeyboard,
    escapeHtml,
    formatDistance,
    formatParticipateButtonLabel,
    getMessageWithLocation,
    haversineMeters,
    isAvatarUrlSafe,
    parsePositiveIntEnv,
    parseRsvpCallbackData,
    pluralizeRiders,
    selectNearestRider,
    type ActiveRider,
    type AnnouncementEvent,
    type NamedPoint,
    type TelegramMessage,
    type TelegramUpdate,
} from './_pure.ts'

Deno.test('escapeHtml экранирует & < > и не трогает остальное', () => {
    assertEquals(escapeHtml('<b>a & b</b>'), '&lt;b&gt;a &amp; b&lt;/b&gt;')
    assertEquals(escapeHtml('обычный текст 🛞'), 'обычный текст 🛞')
})

Deno.test('isAvatarUrlSafe: bot-токен в URL → небезопасно', () => {
    assertEquals(isAvatarUrlSafe(null), false)
    assertEquals(isAvatarUrlSafe(undefined), false)
    assertEquals(isAvatarUrlSafe(''), false)
    assertEquals(isAvatarUrlSafe('https://api.telegram.org/file/bot123:ABC/photos/1.jpg'), false)
    assertEquals(
        isAvatarUrlSafe('https://xyz.supabase.co/storage/v1/object/public/telegram-avatars/1/avatar.jpg'),
        true,
    )
})

Deno.test('parsePositiveIntEnv: парсинг и граничные значения', () => {
    assertEquals(parsePositiveIntEnv(undefined, 500), 500)
    assertEquals(parsePositiveIntEnv('', 500), 500)
    assertEquals(parsePositiveIntEnv('  ', 500), 500)
    assertEquals(parsePositiveIntEnv('0', 500), 500)
    assertEquals(parsePositiveIntEnv('-5', 500), 500)
    assertEquals(parsePositiveIntEnv('abc', 500), 500)
    assertEquals(parsePositiveIntEnv('1', 500), 1)
    assertEquals(parsePositiveIntEnv('  250 ', 500), 250)
})

Deno.test('parseRsvpCallbackData: только rsvp:<uuid>', () => {
    const uuid = '11111111-2222-3333-4444-555555555555'
    assertEquals(parseRsvpCallbackData(`rsvp:${uuid}`), { eventDateId: uuid })
    assertEquals(parseRsvpCallbackData(undefined), null)
    assertEquals(parseRsvpCallbackData('rsvp:'), null)
    assertEquals(parseRsvpCallbackData('rsvp:not-a-uuid'), null)
    assertEquals(parseRsvpCallbackData(`prefix:${uuid}`), null)
    // защита от переполнения: лишние символы после uuid
    assertEquals(parseRsvpCallbackData(`rsvp:${uuid}extra`), null)
})

Deno.test('formatParticipateButtonLabel: число только при count>0', () => {
    assertEquals(formatParticipateButtonLabel(0), 'Участвую')
    assertEquals(formatParticipateButtonLabel(1), 'Участвую (1)')
    assertEquals(formatParticipateButtonLabel(42), 'Участвую (42)')
})

Deno.test('buildRsvpKeyboard: callback и deep-link кнопки в одном ряду', () => {
    const kb = buildRsvpKeyboard('abc', 3, 'https://map.euc.kz', 7)
    assertEquals(kb.inline_keyboard[0][0].callback_data, 'rsvp:abc')
    assertEquals(kb.inline_keyboard[0][0].text, 'Участвую (3)')
    assertEquals(kb.inline_keyboard[0][1].url, 'https://map.euc.kz/events/7')
})

Deno.test('buildAnnouncementHeader: день недели + абсолютное по Алматы + относительный <tg-time>', () => {
    const event: AnnouncementEvent = { id: 1, type: 'group_ride', title: 'Вечерняя', location_text: null }
    // 14:00 UTC = unix 1784037600 → вторник, 19:00 по Алматы (UTC+5)
    const header = buildAnnouncementHeader(event, '2026-07-14T14:00:00Z')
    assertEquals(
        header,
        'Покатушка · <b>Вечерняя</b>\n📅 вторник, 14 июля, 19:00 (<tg-time unix="1784037600" format="r">скоро</tg-time>)',
    )
})

Deno.test('buildAnnouncementHeader: день недели/дата учитывают переход на следующий день по Алматы', () => {
    const event: AnnouncementEvent = { id: 1, type: 'group_ride', title: 'Ночная', location_text: null }
    // 19:00 UTC 14 июля (вторник) → среда, 00:00 15 июля по Алматы (UTC+5)
    const header = buildAnnouncementHeader(event, '2026-07-14T19:00:00Z')
    assertEquals(
        header,
        'Покатушка · <b>Ночная</b>\n📅 среда, 15 июля, 00:00 (<tg-time unix="1784055600" format="r">скоро</tg-time>)',
    )
})

Deno.test('buildAnnouncementHeader: невалидная дата → без даты', () => {
    const event: AnnouncementEvent = { id: 1, type: 'event', title: 'X', location_text: null }
    assertEquals(buildAnnouncementHeader(event, 'not-a-date'), 'Мероприятие · <b>X</b>')
})

Deno.test('buildAnnouncementHeader: совпало первое слово типа и названия → тип опускаем', () => {
    const event: AnnouncementEvent = {
        id: 1,
        type: 'training',
        title: 'Обучение по пятницам на КБТУ',
        location_text: null,
    }
    // type=training → «Обучение»; первое слово названия тоже «Обучение» → выводим только название
    assertEquals(buildAnnouncementHeader(event, 'not-a-date'), '<b>Обучение по пятницам на КБТУ</b>')
})

Deno.test('buildAnnouncementHeader: первое слово не совпало → тип сохраняется', () => {
    const event: AnnouncementEvent = { id: 1, type: 'training', title: 'Вечерний разбор', location_text: null }
    assertEquals(buildAnnouncementHeader(event, 'not-a-date'), 'Обучение · <b>Вечерний разбор</b>')
})

Deno.test('buildAnnouncementHeader: HTML-escape в заголовке', () => {
    const event: AnnouncementEvent = { id: 1, type: 'training', title: '<script>', location_text: null }
    const header = buildAnnouncementHeader(event, 'not-a-date')
    assertEquals(header, 'Обучение · <b>&lt;script&gt;</b>')
})

Deno.test('buildAnnouncementText: шапка + тело (с escape) либо только шапка', () => {
    const event: AnnouncementEvent = { id: 1, type: 'group_ride', title: 'T', location_text: null }
    const withBody = buildAnnouncementText(event, 'not-a-date', '  привет <b>')
    assertEquals(withBody, 'Покатушка · <b>T</b>\n\nпривет &lt;b&gt;')
    const noBody = buildAnnouncementText(event, 'not-a-date', '   ')
    assertEquals(noBody, 'Покатушка · <b>T</b>')
})

Deno.test('buildNewsText: тримит и экранирует HTML, без шапки', () => {
    assertEquals(buildNewsText('  Привет <b>мир</b> & все  '), 'Привет &lt;b&gt;мир&lt;/b&gt; &amp; все')
    assertEquals(buildNewsText('   '), '')
})

Deno.test('buildCancelledAnnouncementText: не экранирует готовый HTML, зачёркивает текст', () => {
    const text = buildCancelledAnnouncementText('Покатушка · <b>T</b>\n\nпривет')
    assertEquals(text, '❌ <b>ОТМЕНЕНО</b>\n\n<s>Покатушка · <b>T</b>\n\nпривет</s>')
})

Deno.test(
    'buildCancelledAnnouncementText: сворачивает <tg-time> в фолбэк (кастомный тег внутри <s> не зачёркивается)',
    () => {
        const src = 'вторник, 14 июля, 19:00 (<tg-time unix="1782568800" format="r">скоро</tg-time>)'
        const text = buildCancelledAnnouncementText(src)
        assertEquals(text, '❌ <b>ОТМЕНЕНО</b>\n\n<s>вторник, 14 июля, 19:00 (скоро)</s>')
    },
)

Deno.test('formatDistance: метры (округление до 10) и километры', () => {
    assertEquals(formatDistance(0), '0 м')
    assertEquals(formatDistance(7), '10 м')
    assertEquals(formatDistance(134), '130 м')
    assertEquals(formatDistance(950), '950 м')
    assertEquals(formatDistance(997), '1.0 км')
    assertEquals(formatDistance(1234), '1.2 км')
    assertEquals(formatDistance(Number.NaN), '')
})

Deno.test('pluralizeRiders: русское склонение', () => {
    assertEquals(pluralizeRiders(1), '1 райдер')
    assertEquals(pluralizeRiders(2), '2 райдера')
    assertEquals(pluralizeRiders(4), '4 райдера')
    assertEquals(pluralizeRiders(5), '5 райдеров')
    assertEquals(pluralizeRiders(11), '11 райдеров')
    assertEquals(pluralizeRiders(21), '21 райдер')
    assertEquals(pluralizeRiders(22), '22 райдера')
    assertEquals(pluralizeRiders(0), '0 райдеров')
})

Deno.test('haversineMeters: ~0 на одной точке, разумный порядок на разнесённых', () => {
    assertEquals(Math.round(haversineMeters(43.2, 76.9, 43.2, 76.9)), 0)
    // ~0.001° по широте ≈ 111 м
    const d = haversineMeters(43.2, 76.9, 43.201, 76.9)
    assertEquals(d > 100 && d < 120, true)
})

Deno.test('selectNearestRider: пусто → null', () => {
    assertEquals(selectNearestRider(76.9, 43.2, [], []), null)
})

Deno.test('selectNearestRider: выбирает ближайшего + ориентир при точке ближе 500 м', () => {
    const riders: ActiveRider[] = [
        { telegramUserId: 1, username: 'far', firstName: null, longitude: 76.95, latitude: 43.25 },
        { telegramUserId: 2, username: 'vanton', firstName: null, longitude: 76.9013, latitude: 43.2 },
    ]
    // точка почти на позиции райдера 2 (в пределах 500 м)
    const points: NamedPoint[] = [{ title: 'КБТУ', longitude: 76.9012, latitude: 43.2 }]
    const nearest = selectNearestRider(76.9, 43.2, riders, points)
    assertEquals(nearest?.name, '@vanton')
    assertEquals(nearest?.atPointTitle, 'КБТУ')
    assertEquals((nearest?.distanceMeters ?? 0) < 200, true)
})

Deno.test('selectNearestRider: точка дальше 500 м → без ориентира; имя из first_name с escape', () => {
    const riders: ActiveRider[] = [
        { telegramUserId: 3, username: null, firstName: '<Толя>', longitude: 76.9, latitude: 43.2 },
    ]
    const points: NamedPoint[] = [{ title: 'КБТУ', longitude: 77.5, latitude: 43.6 }]
    const nearest = selectNearestRider(76.9, 43.2, riders, points)
    assertEquals(nearest?.name, '&lt;Толя&gt;')
    assertEquals(nearest?.atPointTitle, null)
})

Deno.test('buildLiveLocationEphemeralText: есть райдеры + ориентир', () => {
    const text = buildLiveLocationEphemeralText({
        mapBaseUrl: 'https://map.euc.kz',
        telegramUserId: 12345,
        otherRidersCount: 2,
        nearest: { name: '@vanton', distanceMeters: 130, atPointTitle: 'КБТУ' },
    })
    assertEquals(
        text,
        '📍 Твоя геопозиция отображается на <a href="https://map.euc.kz/m/telegramuser/12345">map.euc.kz</a>\n' +
            'Кроме тебя катают: 2 райдера\n' +
            'Ближайший к тебе райдер: @vanton (130 м, у КБТУ)\n\n' +
            'Делитесь геопозицией чаще — в конце сезона подведём классную статистику по самым популярным маршрутам города 🛞',
    )
})

Deno.test('buildLiveLocationEphemeralText: никого рядом → «катаешь один»', () => {
    const text = buildLiveLocationEphemeralText({
        mapBaseUrl: 'https://map.euc.kz',
        telegramUserId: 7,
        otherRidersCount: 0,
        nearest: null,
    })
    assertEquals(
        text,
        '📍 Твоя геопозиция отображается на <a href="https://map.euc.kz/m/telegramuser/7">map.euc.kz</a>\n' +
            'Пока ты катаешь один — зови остальных!\n\n' +
            'Делитесь геопозицией чаще — в конце сезона подведём классную статистику по самым популярным маршрутам города 🛞',
    )
})

Deno.test('buildRsvpEphemeralText: записался → шапка + ссылка на /events/:id', () => {
    const event: AnnouncementEvent = { id: 7, type: 'group_ride', title: 'Вечерняя', location_text: null }
    const text = buildRsvpEphemeralText(event, '2026-07-14T14:00:00Z', true, 'https://map.euc.kz')
    assertEquals(
        text,
        'Ты в списке участников! 🛞\n\n' +
            'Покатушка · <b>Вечерняя</b>\n📅 вторник, 14 июля, 19:00 (<tg-time unix="1784037600" format="r">скоро</tg-time>)\n\n' +
            '<a href="https://map.euc.kz/events/7">Открыть событие на карте</a>',
    )
})

Deno.test('buildRsvpEphemeralText: вышел → без ссылки, шапка сохраняется', () => {
    const event: AnnouncementEvent = { id: 7, type: 'event', title: 'X', location_text: null }
    const text = buildRsvpEphemeralText(event, 'not-a-date', false, 'https://map.euc.kz')
    assertEquals(text, 'Ты больше не участвуешь.\n\nМероприятие · <b>X</b>')
})

Deno.test('getMessageWithLocation: приоритет message → edited → channel', () => {
    const withLoc = (id: number): TelegramMessage => ({
        message_id: id,
        chat: { id: 1 },
        location: { longitude: 76, latitude: 43 },
    })
    const noLoc: TelegramMessage = { message_id: 99, chat: { id: 1 } }

    const u1: TelegramUpdate = { update_id: 1, edited_message: withLoc(2), message: noLoc }
    assertEquals(getMessageWithLocation(u1)?.message_id, 2)

    const u2: TelegramUpdate = { update_id: 2, message: withLoc(10), edited_message: withLoc(20) }
    assertEquals(getMessageWithLocation(u2)?.message_id, 10)

    const u3: TelegramUpdate = { update_id: 3, message: noLoc }
    assertEquals(getMessageWithLocation(u3), null)
})
