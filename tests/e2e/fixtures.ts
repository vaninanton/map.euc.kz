import type { Page, Route } from '@playwright/test'

const SIDEBAR_TIMEOUT = 15_000

/** Ждёт появления сайдбара с информацией об объекте.
 * Данные загружаются асинхронно — при параллельных воркерах нужен запас сверх дефолтного expect.timeout. */
export async function waitForSidebar(page: Page) {
    return page
        .getByRole('dialog', { name: 'Информация об объекте' })
        .waitFor({ state: 'visible', timeout: SIDEBAR_TIMEOUT })
}

export interface SupabaseRequest {
    method: string
    table: string
    body: unknown
    url: string
}

const mapboxStyle = {
    version: 8,
    name: 'E2E empty style',
    sources: {},
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#eef2f7' },
        },
    ],
}

const pointRows = [
    {
        id: 1,
        type: 'point',
        title: 'Парк Горького',
        description: 'Точка встречи',
        coordinates: [76.955, 43.252],
        flag_is_meeting: true,
        flag_has_socket: false,
        map_point_photos: [],
    },
    {
        id: 2,
        type: 'socket',
        title: 'Розетка у кофейни',
        description: null,
        coordinates: [76.948, 43.241],
        flag_is_meeting: false,
        flag_has_socket: true,
        map_point_photos: [],
    },
]

const routeRows = [
    {
        id: 10,
        title: 'Набережная',
        description: 'Короткий маршрут',
        coordinates: [
            [76.9, 43.22],
            [76.91, 43.23],
        ],
        via_coordinates: [],
    },
]

const telegramLocationRows = [
    {
        id: 100,
        created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago — within TTL
        chat_id: -1,
        chat_title: 'EUC Almaty',
        telegram_user_id: 777,
        username: 'rider',
        first_name: 'Test',
        last_name: null,
        longitude: 76.93,
        latitude: 43.23,
        location_accuracy_meters: 12,
    },
]

/** Смещение от «сейчас» в днях с фиксированным временем 19:00 локально. */
function eventDateAt(daysFromNow: number, hour = 19): string {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
}

// Сырые строки из БД (формат до нормализации в normalizeEventRow): map_event_dates,
// photo_bucket/photo_path, start_point/finish_point как вложенные объекты.
const eventRows = [
    {
        id: 'evt-ride',
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        type: 'group_ride',
        title: 'Вечерняя покатушка',
        description: 'Сбор у фонтана',
        photo_bucket: null,
        photo_path: null,
        duration_minutes: 90,
        location_text: 'Парк Первого Президента',
        start_coordinates: [76.95, 43.21],
        finish_coordinates: null,
        start_point: null,
        finish_point: null,
        map_event_dates: [{ id: 'd1', starts_at: eventDateAt(2), note: null, cancelled: false }],
    },
    {
        id: 'evt-training',
        created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        type: 'training',
        title: 'Обучение новичков',
        description: null,
        photo_bucket: null,
        photo_path: null,
        duration_minutes: 60,
        location_text: 'Площадь Республики',
        start_coordinates: null,
        finish_coordinates: null,
        start_point: { id: 1, title: 'Парк Горького', coordinates: [76.955, 43.252] },
        finish_point: null,
        map_event_dates: [{ id: 'd2', starts_at: eventDateAt(5), note: null, cancelled: false }],
    },
    {
        id: 'evt-meeting',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        type: 'event',
        title: 'Большая встреча райдеров',
        description: 'Ежегодный слёт сообщества',
        photo_bucket: null,
        photo_path: null,
        duration_minutes: null,
        location_text: null,
        start_coordinates: null,
        finish_coordinates: null,
        start_point: null,
        finish_point: null,
        map_event_dates: [{ id: 'd3', starts_at: eventDateAt(10), note: null, cancelled: false }],
    },
]

const telegramProfileRows = [
    {
        telegram_user_id: 777,
        username: 'rider',
        first_name: 'Test',
        last_name: null,
        avatar_url: 'https://e2e.supabase.co/storage/v1/object/public/telegram-avatars/777.jpg',
        updated_at: '2026-05-07T09:01:00Z',
    },
]

function tableFromUrl(url: string): string {
    const pathname = new URL(url).pathname
    return pathname.split('/').pop() ?? ''
}

function requestJsonBody(route: Route): unknown {
    const postData = route.request().postData()
    if (!postData) return null
    try {
        return JSON.parse(postData) as unknown
    } catch {
        return null
    }
}

async function fulfillJson(route: Route, status: number, body: unknown) {
    await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
    })
}

export async function mockExternalServices(page: Page, requests: SupabaseRequest[] = []) {
    const context = page.context()

    await context.route('https://api.mapbox.com/styles/v1/**', async (route) => {
        await fulfillJson(route, 200, mapboxStyle)
    })
    await context.route('https://events.mapbox.com/**', async (route) => {
        await fulfillJson(route, 200, {})
    })
    // 1×1 transparent PNG stub for avatar images served from Supabase Storage
    const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
    )
    await context.route('https://e2e.supabase.co/storage/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng })
    })
    await context.route('https://*.supabase.co/rest/v1/**', async (route) => {
        const request = route.request()
        const hostname = new URL(request.url()).hostname
        if (hostname !== 'e2e.supabase.co') {
            await fulfillJson(route, 599, { message: `Unexpected Supabase host in e2e test: ${hostname}` })
            return
        }

        const table = tableFromUrl(request.url())
        const method = request.method()
        requests.push({
            method,
            table,
            body: requestJsonBody(route),
            url: request.url(),
        })

        if (method === 'GET' && table === 'map_points') {
            await fulfillJson(route, 200, pointRows)
            return
        }
        if (method === 'GET' && table === 'map_routes') {
            await fulfillJson(route, 200, routeRows)
            return
        }
        if (method === 'GET' && table === 'map_events') {
            await fulfillJson(route, 200, eventRows)
            return
        }
        if (method === 'GET' && table === 'telegram_locations') {
            await fulfillJson(route, 200, telegramLocationRows)
            return
        }
        if (method === 'POST' && table === 'get_latest_telegram_locations') {
            await fulfillJson(route, 200, telegramLocationRows)
            return
        }
        if (method === 'GET' && table === 'telegram_profiles') {
            await fulfillJson(route, 200, telegramProfileRows)
            return
        }
        if (method === 'POST' && table === 'map_points_submissions') {
            await fulfillJson(route, 201, [])
            return
        }

        await fulfillJson(route, 404, { message: `Unhandled e2e Supabase route: ${method} ${table}` })
    })
}
