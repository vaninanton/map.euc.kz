import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mockExternalServices } from './fixtures'

async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}

test.describe('LiveActivityBar — индикатор активных райдеров', () => {
    test('показывает кнопку с числом активных райдеров', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/')

        // В фикстурах есть 1 райдер с координатами 2 минуты назад — внутри TTL
        await expect(page.getByRole('button', { name: 'Катают: 1' })).toBeVisible()
        await attachScreenshot(testInfo, 'live-activity-bar-visible', page)
    })

    test('клик при одном райдере открывает его сайдбар', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/')

        await page.getByRole('button', { name: 'Катают: 1' }).click()

        // При 1 активном райдере открывается его карточка в сайдбаре (а не радар)
        await expect(page.getByRole('dialog', { name: 'Информация об объекте' })).toBeVisible()
        await expect(page.getByText('@rider')).toBeVisible()
        await attachScreenshot(testInfo, 'live-activity-bar-click-opens-sidebar', page)
    })
})
