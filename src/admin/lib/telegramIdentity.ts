import { requireSupabase } from '@/lib/supabase'
import { adminUrl } from '@/admin/utils/adminUrl'
import type { UserIdentity } from '@supabase/supabase-js'

/**
 * Telegram заведён в Supabase Auth как Custom OAuth/OIDC-провайдер, поэтому имя идёт с
 * префиксом `custom:` — встроенного провайдера `telegram` в GoTrue нет (на голое имя
 * приходит 400 «Provider telegram could not be found»). Подпись ID-токенов в BotFather
 * должна оставаться RS256: ES256K (secp256k1) Supabase не поддерживает.
 */
export const TELEGRAM_PROVIDER = 'custom:telegram'

type SupabaseAuth = ReturnType<typeof requireSupabase>['auth']
type OAuthProvider = Parameters<SupabaseAuth['signInWithOAuth']>[0]['provider']

// В типах auth-js перечислены только встроенные провайдеры, `custom:*` в объединение не входит.
const provider = TELEGRAM_PROVIDER as unknown as OAuthProvider

/**
 * Вход через Telegram. Заводит нового пользователя, если у аккаунта ещё нет
 * привязанной telegram-identity: email Telegram не отдаёт, поэтому автосклейка
 * по почте невозможна — связывать аккаунты нужно через `linkTelegram`.
 */
export async function signInWithTelegram(): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: adminUrl() },
    })
    if (error) throw error
}

/**
 * Привязывает Telegram к текущему аккаунту (manual linking).
 * Требует включённого «Allow manual linking» в настройках Supabase Auth.
 */
export async function linkTelegram(): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.auth.linkIdentity({
        provider,
        options: { redirectTo: adminUrl() },
    })
    if (error) throw error
}

/** Привязанная к текущему пользователю telegram-identity (или `null`). */
export async function fetchTelegramIdentity(): Promise<UserIdentity | null> {
    const client = requireSupabase()
    const { data, error } = await client.auth.getUserIdentities()
    if (error) throw error
    return data.identities.find((identity) => identity.provider === TELEGRAM_PROVIDER) ?? null
}

/** Отвязывает Telegram. GoTrue не даст отвязать последнюю identity аккаунта. */
export async function unlinkTelegram(identity: UserIdentity): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.auth.unlinkIdentity(identity)
    if (error) throw error
}

function claim(data: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = data[key]
        if (typeof value === 'string' && value.length > 0) return value
    }
    return undefined
}

/**
 * Подпись привязанного аккаунта: @username, имя, телефон или telegram id — что нашлось.
 * Имена ключей зависят от attribute mapping кастомного провайдера: Telegram отдаёт
 * `preferred_username`/`name`/`phone_number`, GoTrue может переложить их в `user_name`/`full_name`.
 */
export function describeTelegramIdentity(identity: UserIdentity): string {
    const data = (identity.identity_data ?? {}) as Record<string, unknown>
    const username = claim(data, ['user_name', 'preferred_username'])
    if (username) return `@${username}`
    return claim(data, ['full_name', 'name', 'phone_number']) ?? `id ${identity.id}`
}
