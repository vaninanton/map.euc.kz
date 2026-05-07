import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4174)

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.e2e.ts',
    timeout: 30_000,
    expect: {
        timeout: 7_500,
    },
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: `http://127.0.0.1:${String(port)}`,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${String(port)}`,
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
