import path from 'node:path'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// SPA-фолбэк на Cloudflare Pages делает public/_redirects (/* /index.html 200),
// поэтому копия index.html как 404.html (нужная GitHub Pages) больше не собирается.
//
// Плагина base-url-meta здесь тоже больше нет: OG-теги в index.html теперь содержат
// абсолютные URL (краулеры не резолвят относительные), а для ссылок на конкретную
// сущность их подменяет Pages Function — functions/m/[type]/[id].ts.

// https://vite.dev/config/
export default defineConfig(() => {
    return {
        define: {
            __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA ?? String(Date.now())),
        },
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: { '@': path.resolve(__dirname, 'src') },
        },
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: ['src/test/setup.ts'],
            // Edge Functions (Deno, https://-импорты) тестируются через `deno test`, не Vitest.
            exclude: [...configDefaults.exclude, 'supabase/functions/**'],
        },
        // Сайт живёт в корне домена map.euc.kz (Cloudflare Pages). Префикс /map.euc/
        // был нужен только для github.io и в прод-сборку никогда не попадал.
        base: '/',
        server: {
            host: true,
            allowedHosts: ['map.euc.test', 'test.euc.kz'],
        },
        build: {
            rolldownOptions: {
                output: {
                    codeSplitting: {
                        groups: [{ test: /node_modules\/mapbox-gl/, name: 'mapbox-gl' }],
                    },
                },
            },
            chunkSizeWarningLimit: 600,
        },
    }
})
