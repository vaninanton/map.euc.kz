import type { Page, Route } from '@playwright/test'

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
        if (method === 'GET' && table === 'telegram_locations') {
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
