/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string | undefined
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined
  readonly VITE_YANDEX_METRIKA_ID: string | undefined
  readonly VITE_TELEGRAM_GEO_TTL_MINUTES: string | undefined
  readonly VITE_TELEGRAM_TRACK_TAIL_MINUTES: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string
