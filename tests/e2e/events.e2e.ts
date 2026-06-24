import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mockExternalServices } from './fixtures'

async function attachScreenshot(testInfo: TestInfo, name: string, page: Page) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}

/** Лента событий — диалог с aria-label «События». */
function eventsScreen(page: Page) {
    return page.getByRole('dialog', { name: 'События' })
}

test.describe('Лента событий — открытие', () => {
    test('таб «События» открывает ленту и меняет URL на /events', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/')

        await page
            .getByRole('navigation', { name: 'Основная навигация' })
            .getByRole('button', { name: /^События/ })
            .click()

        await expect(eventsScreen(page)).toBeVisible()
        await expect(page).toHaveURL('/events')
        await attachScreenshot(testInfo, 'events-screen-open', page)
    })

    test('deep link /events открывает ленту с карточками событий', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events')

        const screen = eventsScreen(page)
        await expect(screen).toBeVisible()

        await expect(screen.getByRole('heading', { name: 'Вечерняя покатушка' })).toBeVisible()
        await expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeVisible()
        await expect(screen.getByRole('heading', { name: 'Большая встреча райдеров' })).toBeVisible()
    })

    test('кнопка «Закрыть» убирает ленту и возвращает на /', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events')

        const screen = eventsScreen(page)
        await expect(screen).toBeVisible()

        await screen.getByRole('button', { name: 'Закрыть' }).click()

        await expect(screen).toBeHidden()
        await expect(page).toHaveURL('/')
    })
})

test.describe('Лента событий — фильтр по типу', () => {
    test('фильтр «Обучение» оставляет только обучающие события', async ({ page }, testInfo) => {
        await mockExternalServices(page)
        await page.goto('/events')

        const screen = eventsScreen(page)
        await expect(screen.getByRole('heading', { name: 'Вечерняя покатушка' })).toBeVisible()

        await screen.getByRole('button', { name: 'Обучение', exact: true }).click()

        await expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeVisible()
        await expect(screen.getByRole('heading', { name: 'Вечерняя покатушка' })).toBeHidden()
        await expect(screen.getByRole('heading', { name: 'Большая встреча райдеров' })).toBeHidden()
        await attachScreenshot(testInfo, 'events-filter-training', page)
    })

    test('фильтр «Покатушка» оставляет только покатушки', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events')

        const screen = eventsScreen(page)
        await screen.getByRole('button', { name: 'Покатушка', exact: true }).click()

        await expect(screen.getByRole('heading', { name: 'Вечерняя покатушка' })).toBeVisible()
        await expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeHidden()
    })

    test('фильтр «Все» возвращает все события', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events')

        const screen = eventsScreen(page)
        await screen.getByRole('button', { name: 'Покатушка', exact: true }).click()
        await expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeHidden()

        await screen.getByRole('button', { name: 'Все', exact: true }).click()

        await expect(screen.getByRole('heading', { name: 'Вечерняя покатушка' })).toBeVisible()
        await expect(screen.getByRole('heading', { name: 'Обучение новичков' })).toBeVisible()
        await expect(screen.getByRole('heading', { name: 'Большая встреча райдеров' })).toBeVisible()
    })
})

test.describe('Лента событий — карточка ведёт на страницу события', () => {
    test('карточка — ссылка на /events/:id и показывает тип', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events')

        const screen = eventsScreen(page)
        const card = screen.getByRole('link').filter({ hasText: 'Обучение новичков' })
        await expect(card).toBeVisible()

        // Тип события на превью карточки.
        await expect(card.getByText('Обучение', { exact: true })).toBeVisible()
        // Вся карточка ведёт на страницу события.
        await expect(card).toHaveAttribute('href', /\/events\/evt-training$/)
    })

    test('клик по карточке открывает страницу события с привязанной точкой-стартом', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events')

        const screen = eventsScreen(page)
        await screen.getByRole('link').filter({ hasText: 'Обучение новичков' }).click()

        const detail = page.getByRole('dialog', { name: 'Событие' })
        await expect(detail).toBeVisible()
        await expect(page).toHaveURL('/events/evt-training')

        // На странице события привязанная точка-старт рендерится ссылкой на карточку точки.
        // У этого события есть и точка-старт, и текстовое место — на кнопке показывается место.
        const startLink = detail.getByRole('link', { name: /Площадь Республики/ })
        await expect(startLink).toHaveAttribute('href', /\/m\/point\/1$/)
    })

    test('страница события с ручными координатами старта показывает «Показать на карте»', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events/evt-ride')

        const detail = page.getByRole('dialog', { name: 'Событие' })
        await expect(detail).toBeVisible()

        await expect(detail.getByRole('button', { name: 'Показать на карте' })).toBeVisible()
    })

    test('клик по «Показать на карте» закрывает страницу и центрирует карту', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/events/evt-ride')

        const detail = page.getByRole('dialog', { name: 'Событие' })
        await detail.getByRole('button', { name: 'Показать на карте' }).click()

        await expect(detail).toBeHidden()
        await expect(page).toHaveURL('/')
    })
})

test.describe('Лента событий — бейдж непрочитанных', () => {
    test('бейдж показывает число непрочитанных и обнуляется после открытия', async ({ page }) => {
        await mockExternalServices(page)
        await page.goto('/')

        const eventsTab = page
            .getByRole('navigation', { name: 'Основная навигация' })
            .getByRole('button', { name: /^События/ })

        // Лента ещё не открывалась — все три актуальных события считаются непрочитанными.
        await expect(eventsTab).toHaveAccessibleName('События, непрочитанных: 3')

        await eventsTab.click()
        await expect(eventsScreen(page)).toBeVisible()

        await page.getByRole('dialog', { name: 'События' }).getByRole('button', { name: 'Закрыть' }).click()

        // После просмотра бейдж сброшен — в имени таба больше нет «непрочитанных».
        await expect(eventsTab).toHaveAccessibleName('События')
    })
})

test.describe('Лента событий — пустое состояние и ошибка', () => {
    test('пустой список показывает «Пока нет событий»', async ({ page }) => {
        await mockExternalServices(page)
        await page.context().route('https://e2e.supabase.co/rest/v1/map_events**', async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        })
        await page.goto('/events')

        await expect(eventsScreen(page).getByText('Пока нет событий')).toBeVisible()
    })
})
