import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mockExternalServices, waitForSidebar } from './fixtures'

async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}

test.describe('deep links — открытие сайдбара по URL', () => {
    test('deep link /m/point/1 показывает сайдбар с названием точки', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/m/point/1')
        await waitForSidebar(page)

        await expect(page.getByText('Парк Горького')).toBeVisible()
        await attachScreenshot(testInfo, 'deep-link-point-sidebar', page)
    })

    test('deep link /m/route/10 показывает сайдбар с названием маршрута', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/m/route/10')
        await waitForSidebar(page)

        await expect(page.getByText('Набережная')).toBeVisible()
        await attachScreenshot(testInfo, 'deep-link-route-sidebar', page)
    })

    test('deep link на несуществующий объект не показывает сайдбар', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/m/point/9999')

        await expect(page.getByRole('dialog', { name: 'Информация об объекте' })).toBeHidden()
    })
})

test.describe('FeatureSidebar — закрытие', () => {
    test('кнопка «Закрыть» убирает сайдбар с экрана', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/m/point/1')

        const sidebar = page.getByRole('dialog', { name: 'Информация об объекте' })
        await waitForSidebar(page)

        await sidebar.getByRole('button', { name: 'Закрыть' }).click()

        await expect(sidebar).toBeHidden()
    })

    test('после закрытия сайдбара URL меняется на /', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/m/point/1')
        await waitForSidebar(page)

        await page.getByRole('dialog', { name: 'Информация об объекте' }).getByRole('button', { name: 'Закрыть' }).click()

        await expect(page).toHaveURL('/')
    })
})
