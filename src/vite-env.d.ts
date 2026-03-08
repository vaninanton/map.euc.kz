/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string | undefined
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_KEY: string | undefined
  readonly VITE_YANDEX_METRIKA_ID: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
