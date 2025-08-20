import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        tailwindcss(),
        VitePWA({
            manifest: {
                id: '/',
                lang: 'ru',
                dir: 'ltr',
                name: 'map.euc.kz',
                short_name: 'map.euc.kz',
                description: 'Мономаршруты',
                orientation: 'portrait',
                icons: [
                    {
                        src: '/euc.kz.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/android/android-launchericon-512-512.png',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/android/android-launchericon-192-192.png',
                        sizes: '192x192',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/android/android-launchericon-144-144.png',
                        sizes: '144x144',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/android/android-launchericon-96-96.png',
                        sizes: '96x96',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/android/android-launchericon-72-72.png',
                        sizes: '72x72',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/android/android-launchericon-48-48.png',
                        sizes: '48x48',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/16.png',
                        sizes: '16x16',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/20.png',
                        sizes: '20x20',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/29.png',
                        sizes: '29x29',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/32.png',
                        sizes: '32x32',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/40.png',
                        sizes: '40x40',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/50.png',
                        sizes: '50x50',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/57.png',
                        sizes: '57x57',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/58.png',
                        sizes: '58x58',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/60.png',
                        sizes: '60x60',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/64.png',
                        sizes: '64x64',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/72.png',
                        sizes: '72x72',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/76.png',
                        sizes: '76x76',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/80.png',
                        sizes: '80x80',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/87.png',
                        sizes: '87x87',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/100.png',
                        sizes: '100x100',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/114.png',
                        sizes: '114x114',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/120.png',
                        sizes: '120x120',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/128.png',
                        sizes: '128x128',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/144.png',
                        sizes: '144x144',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/152.png',
                        sizes: '152x152',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/167.png',
                        sizes: '167x167',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/180.png',
                        sizes: '180x180',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/192.png',
                        sizes: '192x192',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/256.png',
                        sizes: '256x256',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/512.png',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/assets/ios/1024.png',
                        sizes: '1024x1024',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                ],
                display: 'fullscreen',
            },
        }),
    ],
    server: {
        allowedHosts: true,
    },
    build: {
        assetsInlineLimit: 0,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('@geoman-io')) {
                        return '@geoman-io'
                    }
                    if (id.includes('leaflet')) {
                        return 'leaflet'
                    }
                    return
                },
            },
        },
    },
})
