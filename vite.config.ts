import path from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Подставляет base в %BASE_URL% в index.html для og:image, og:url, twitter:image */
function baseUrlMetaPlugin(): Plugin {
    let base = '/'
    return {
        name: 'base-url-meta',
        configResolved(config: ResolvedConfig) {
            base = config.base
        },
        transformIndexHtml(html: string) {
            return html.replace(/%BASE_URL%/g, base)
        },
    }
}

// SPA-фолбэк на Cloudflare Pages делает public/_redirects (/* /index.html 200),
// поэтому копия index.html как 404.html (нужная GitHub Pages) больше не собирается.

// https://vite.dev/config/
export default defineConfig(() => {
    return {
        define: {
            __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA ?? String(Date.now())),
        },
        plugins: [baseUrlMetaPlugin(), react(), tailwindcss()],
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
