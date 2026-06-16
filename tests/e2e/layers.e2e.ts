import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mockExternalServices } from './fixtures'

async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}

test.describe('LayerPanel — переключение слоёв', () => {
    test('переключатель «Маршруты» меняет состояние', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/')

        await page.getByLabel('Фильтры слоёв').click()
        const layerPanel = page.getByRole('group', { name: 'Слои карты' })
        await expect(layerPanel).toBeVisible()

        const routesCheckbox = layerPanel.getByRole('checkbox', { name: 'Маршруты' })
        await expect(routesCheckbox).toBeChecked()

        // Кликаем по label (span с текстом), т.к. input перекрыт декоративным span[aria-hidden]
        await layerPanel.getByText('Маршруты').click()
        await expect(routesCheckbox).not.toBeChecked()

        await layerPanel.getByText('Маршруты').click()
        await expect(routesCheckbox).toBeChecked()
    })

    test('переключатель «Розетки» меняет состояние', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/')

        await page.getByLabel('Фильтры слоёв').click()
        const layerPanel = page.getByRole('group', { name: 'Слои карты' })

        const socketsCheckbox = layerPanel.getByRole('checkbox', { name: 'Розетки' })
        await expect(socketsCheckbox).toBeChecked()

        await layerPanel.getByText('Розетки').click()
        await expect(socketsCheckbox).not.toBeChecked()
    })

    test('переключатель «Спутник» меняет состояние', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/')

        await page.getByLabel('Фильтры слоёв').click()
        const layerPanel = page.getByRole('group', { name: 'Слои карты' })

        const satelliteCheckbox = layerPanel.getByRole('checkbox', { name: 'Спутник' })
        await expect(satelliteCheckbox).not.toBeChecked()

        // Кликаем по тексту label — input перекрыт декоративным span[aria-hidden]
        await layerPanel.getByText('Спутник').click()
        await expect(satelliteCheckbox).toBeChecked()
        await attachScreenshot(testInfo, 'layer-panel-satellite-on', page)

        await layerPanel.getByText('Спутник').click()
        await expect(satelliteCheckbox).not.toBeChecked()
    })

    test('панель слоёв закрывается кнопкой ×', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/')

        await page.getByLabel('Фильтры слоёв').click()
        const layerPanel = page.getByRole('group', { name: 'Слои карты' })
        await expect(layerPanel).toBeVisible()

        await layerPanel.getByRole('button', { name: 'Закрыть панель слоев' }).click()
        await expect(layerPanel).toBeHidden()
    })
})
