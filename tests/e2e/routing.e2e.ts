import { expect, test } from '@playwright/test'
import { mockExternalServices } from './fixtures'

// Контракт SPA-роутинга: прямой заход на любой путь отдаёт бандл со статусом 200,
// дальше маршрут разбирает React Router. В тестах фолбэк реализует `vite preview`,
// в проде — public/_redirects (/* /index.html 200); соответствие прод-конфигурации
// проверяется чеклистом из docs/deployment.md после деплоя.
const ROUTES = ['/', '/radar', '/events', '/events/evt-ride', '/m/point/1', '/m/route/10', '/help']

test.describe('SPA-роутинг — прямые заходы', () => {
    for (const route of ROUTES) {
        test(`${route} отдаётся как HTML со статусом 200`, async ({ page }) => {
            await mockExternalServices(page)
            const response = await page.goto(route)

            expect(response?.status()).toBe(200)
            expect(response?.headers()['content-type']).toContain('text/html')
        })
    }

    test('неизвестный путь отдаёт бандл и редиректит на карту', async ({ page }) => {
        await mockExternalServices(page)
        const response = await page.goto('/no-such-page')

        expect(response?.status()).toBe(200)
        // NotFound — это <Navigate to="/" replace />, редирект уже на клиенте.
        await expect(page).toHaveURL('/')
    })
})
