import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Подставляет base (например /map.euc/) в %BASE_URL% в index.html для og:image, og:url, twitter:image */
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

/**
 * SPA-fallback для GitHub Pages: при production-сборке кладёт копию index.html как 404.html,
 * чтобы прямой заход на любой путь возвращал тот же бандл, а React Router сам решал, что показать.
 */
function spaFallback404Plugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const indexPath = path.resolve(outDir, 'index.html')
      const fallbackPath = path.resolve(outDir, '404.html')
      if (existsSync(indexPath)) {
        copyFileSync(indexPath, fallbackPath)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA ?? String(Date.now())),
    },
    plugins: [baseUrlMetaPlugin(), spaFallback404Plugin(), react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    base: process.env.GITHUB_PAGES === 'true' ? '/map.euc/' : '/',
    server: {
      host: true,
      allowedHosts: ['map.euc.test', 'test.euc.kz'],
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { test: /node_modules\/mapbox-gl/, name: 'mapbox-gl' },
            ],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  }
})
