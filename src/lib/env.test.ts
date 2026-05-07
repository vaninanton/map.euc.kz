import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTelegramGeoTtlMinutes, getViteSupabaseConfig } from '@/lib/env'

describe('env', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('getViteSupabaseConfig возвращает null без ключей', () => {
        vi.stubEnv('VITE_SUPABASE_URL', '')
        vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
        expect(getViteSupabaseConfig()).toBeNull()
    })

    it('getTelegramGeoTtlMinutes читает положительное целое', () => {
        vi.stubEnv('VITE_TELEGRAM_GEO_TTL_MINUTES', '42')
        expect(getTelegramGeoTtlMinutes()).toBe(42)
    })
})
