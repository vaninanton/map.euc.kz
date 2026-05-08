import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mockExternalServices } from './fixtures'

// Центр Алматы — близко к fixture-координатам райдера (76.93, 43.23)
const USER_GEOLOCATION = { latitude: 43.238, longitude: 76.945, accuracy: 10 }

async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}


test.describe('радар — с геолокацией', () => {
    test.use({
        geolocation: USER_GEOLOCATION,
        permissions: ['geolocation'],
    })

    test('открывается напрямую по маршруту /radar', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        await expect(page.getByRole('heading', { name: /РАДАР/i })).toBeVisible()
        // Modal close button (×), distinguished from the map-control toggle button
        await expect(page.getByRole('button', { name: 'Закрыть радар' }).filter({ hasText: '×' })).toBeVisible()
        await attachScreenshot(testInfo, 'radar-direct-open', page)
    })

    test('открывается кнопкой «Открыть радар» в панели слоёв', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/')

        await page.getByLabel('Развернуть панель слоев').click()
        await page.getByLabel('Открыть радар').click()

        await expect(page.getByRole('heading', { name: /РАДАР/i })).toBeVisible()
        await attachScreenshot(testInfo, 'radar-open-via-controls', page)
    })

    test('закрывается кнопкой × и убирает заголовок', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        await expect(page.getByRole('heading', { name: /РАДАР/i })).toBeVisible()
        await page.getByRole('button', { name: 'Закрыть радар' }).filter({ hasText: '×' }).click()

        await expect(page.getByRole('heading', { name: /РАДАР/i })).toBeHidden()
    })

    test('отображает SVG-радар', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        const radar = page.getByRole('img', { name: 'Круговой радар райдеров' })
        await expect(radar).toBeVisible()
        await attachScreenshot(testInfo, 'radar-svg-visible', page)
    })

    test('показывает райдера @rider в списке', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        await expect(page.getByText('@rider').first()).toBeVisible()
        await attachScreenshot(testInfo, 'radar-rider-in-list', page)
    })

    test('показывает ближайшую точку рядом с именем райдера', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        // Rider at (76.93, 43.23); nearest fixture point is «Розетка у кофейни» (76.948, 43.241) ≈ 1.9 km
        const riderRow = page.locator('button').filter({ hasText: '@rider' })
        await expect(riderRow).toBeVisible()
        await expect(riderRow).toContainText('Розетка у кофейни')
    })

    test('переключает шкалу и обновляет текст кнопки', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        const scaleBtn = page.getByRole('button', { name: 'Переключить на линейную шкалу' })
        await expect(scaleBtn).toBeVisible()

        await scaleBtn.click()

        await expect(page.getByRole('button', { name: 'Переключить на логарифмическую шкалу' })).toBeVisible()

        await page.getByRole('button', { name: 'Переключить на логарифмическую шкалу' }).click()
        await expect(page.getByRole('button', { name: 'Переключить на линейную шкалу' })).toBeVisible()
    })

    test('кнопка АВТОВРАЩАТЬ меняет aria-label при нажатии', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        const compassBtn = page.getByRole('button', { name: 'Включить вращение по компасу' })
        await expect(compassBtn).toBeVisible()

        await compassBtn.click()

        // В desktop Chromium DeviceOrientationEvent.requestPermission отсутствует — компас включается сразу
        await expect(page.getByRole('button', { name: 'Выключить вращение по компасу' })).toBeVisible()
    })

    test('клик по строке райдера закрывает радар', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        const riderRow = page.locator('button').filter({ hasText: '@rider' }).first()
        await expect(riderRow).toBeVisible()
        await riderRow.click()

        await expect(page.getByRole('heading', { name: /РАДАР/i })).toBeHidden()
    })

    test('информация о шкале отображается под радаром', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        await expect(page.getByText(/лог · макс/i)).toBeVisible()
    })
})

test.describe('радар — без геолокации', () => {
    test.use({ permissions: [] })

    test('показывает сообщение об ожидании или ошибке геолокации', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        await expect(page.getByRole('heading', { name: /РАДАР/i })).toBeVisible()
        // Либо «определяем координаты», либо сообщение об отказе в разрешении
        await expect(page.getByText(/координаты|геолокация|отклонён/i)).toBeVisible()
        await attachScreenshot(testInfo, 'radar-no-geolocation', page)
    })

    test('не показывает SVG-радар без позиции', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/radar')

        await expect(page.getByRole('img', { name: 'Круговой радар райдеров' })).toBeHidden()
    })
})
