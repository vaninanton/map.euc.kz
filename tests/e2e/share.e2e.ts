import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mockExternalServices, waitForSidebar } from './fixtures'

async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}

test.describe('ShareBlock — кнопки шаринга', () => {
    test('кнопка «Яндекс.Карты» присутствует в сайдбаре точки', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/m/point/1')
        await waitForSidebar(page)

        await expect(page.getByTitle('Яндекс.Карты')).toBeVisible()
    })

    test('кнопка «2GIS» присутствует в сайдбаре точки', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/m/point/1')
        await waitForSidebar(page)

        await expect(page.getByTitle('2GIS')).toBeVisible()
    })

    test('клик по «Копировать ссылку» показывает тост-подтверждение', async ({ page }, testInfo) => {
        await mockExternalServices(page)

        // Мокируем clipboard.writeText до загрузки страницы — headless Chromium не даёт реальный доступ
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: () => Promise.resolve() },
                configurable: true,
            })
        })

        await page.goto('/m/point/1')
        await waitForSidebar(page)

        await page.getByRole('button', { name: 'Копировать ссылку' }).click()

        await expect(page.getByRole('status')).toContainText('Скопировано')
        await attachScreenshot(testInfo, 'shareblock-copy-toast', page)
    })
})
