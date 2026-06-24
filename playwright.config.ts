import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4174)

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.e2e.ts',
    timeout: 45_000,
    expect: {
        // Данные (Mapbox + Supabase-моки) грузятся асинхронно; запас, чтобы под нагрузкой
        // параллельных воркеров ассерты не флакали из-за гонки с первой отрисовкой.
        timeout: 10_000,
    },
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 1,
    // На CI используем все ядра ubuntu-latest (4) — Playwright по умолчанию берёт лишь cores/2.
    // Тесты I/O-bound (ждут сеть/отрисовку), так что полная загрузка ядер ускоряет без флака.
    workers: process.env.CI ? 4 : '50%',
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: `http://127.0.0.1:${String(port)}`,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        // Превью статической сборки (а не dev-сервер): без транспиляции на лету страницы
        // грузятся быстрее и стабильнее под нагрузкой параллельных воркеров (меньше флака).
        // Сборку делает заранее `npm run test:e2e` (pretest:e2e строит с e2e-env).
        command: `npm run preview -- --host 127.0.0.1 --port ${String(port)} --strictPort`,
        url: `http://127.0.0.1:${String(port)}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            VITE_MAPBOX_TOKEN: 'e2e-mapbox-token',
            VITE_SUPABASE_URL: 'https://e2e.supabase.co',
            VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-publishable-key',
            VITE_TELEGRAM_GEO_TTL_MINUTES: '60',
            VITE_TELEGRAM_TRACK_TAIL_MINUTES: '30',
            VITE_TELEGRAM_MAX_ACCURACY_METERS: '100',
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
