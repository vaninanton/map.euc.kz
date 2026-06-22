import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mockExternalServices, type SupabaseRequest } from './fixtures'

async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}

test.describe('map smoke flow', () => {
    test('loads map shell, toggles layer panel, and opens project info', async ({ page }, testInfo) => {
        await mockExternalServices(page)

        await page.goto('/')

        await expect(page.getByLabel('Фильтры слоёв')).toBeVisible()
        await page.getByLabel('Фильтры слоёв').click()

        const layerPanel = page.getByRole('group', { name: 'Слои карты' })
        await expect(layerPanel).toBeVisible()
        await expect(layerPanel.getByText('Точки')).toBeVisible()
        await expect(layerPanel.getByText('Маршруты')).toBeVisible()
        await expect(layerPanel.getByText('Розетки')).toBeVisible()
        await attachScreenshot(testInfo, 'map-layer-panel', page)

        await page.getByLabel('Помощь').click()
        await expect(page.getByRole('heading', { name: 'map.euc.kz' })).toBeVisible()
        await expect(page.getByText('карта для моноколесников Алматы')).toBeVisible()
        await attachScreenshot(testInfo, 'project-info-modal', page)

        await page.getByLabel('Закрыть', { exact: true }).click()
        await expect(page.getByRole('heading', { name: 'map.euc.kz' })).toBeHidden()
    })

    test('validates add-point form before coordinates are selected', async ({ page }, testInfo) => {
        await mockExternalServices(page)

        await page.goto('/')
        await page.getByLabel('Добавить').click()

        await expect(page.getByRole('heading', { name: 'Добавить объект' })).toBeVisible()

        const submitBtn = page.getByRole('button', { name: 'Отправить' })
        await expect(submitBtn).toBeDisabled()

        await expect(page.getByText('Нажмите на карту, чтобы выбрать место')).toBeVisible()
        await attachScreenshot(testInfo, 'add-point-validation-disabled', page)
    })

    test('submits a new point draft through Supabase REST', async ({ page }, testInfo) => {
        const requests: SupabaseRequest[] = []
        await mockExternalServices(page, requests)

        await page.goto('/')
        await page.getByLabel('Добавить').click()
        await page.locator('.mapboxgl-canvas').click({ position: { x: 360, y: 260 } })
        await page.getByLabel('Название').fill('Новая точка встречи')
        await page.getByLabel('Описание').fill('Проверка e2e заявки')
        await page.getByRole('button', { name: 'Отправить' }).click()

        await expect(page.getByText('Заявка отправлена на модерацию.')).toBeVisible()
        await attachScreenshot(testInfo, 'add-point-submit-success', page)

        const insertRequest = requests.find(
            (request) => request.method === 'POST' && request.table === 'map_points_submissions',
        )
        expect(insertRequest?.body).toMatchObject({
            type: 'point',
            title: 'Новая точка встречи',
            description: 'Проверка e2e заявки',
            flag_is_meeting: false,
        })
        expect(insertRequest?.body).toHaveProperty('coordinates')
    })
})
