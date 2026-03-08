import path from 'node:path'
import { defineConfig, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Подставляет base (например /map.euc/) в %BASE_URL% в index.html для og:image, og:url, twitter:image */
function baseUrlMetaPlugin() {
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [baseUrlMetaPlugin(), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  base: process.env.GITHUB_PAGES === 'true' ? '/map.euc/' : '/',
  server: {
    host: true,
    allowedHosts: ['map.euc.test'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'mapbox-gl': ['mapbox-gl'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
