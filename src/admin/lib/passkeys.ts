import { requireSupabase } from '@/lib/supabase'

/** Пасскей (WebAuthn-креденшл) из Supabase Auth. */
export interface AdminPasskey {
    id: string
    friendly_name: string | null
    created_at: string
    last_used_at: string | null
}

/**
 * Поддерживает ли браузер WebAuthn с платформенным аутентификатором.
 * Без этого кнопки пасскея бессмысленны — показываем подсказку вместо них.
 */
export function isPasskeySupported(): boolean {
    if (typeof window === 'undefined' || typeof window.PublicKeyCredential !== 'function') return false
    // В старых браузерах и jsdom navigator.credentials может отсутствовать, хотя типы это отрицают.
    const { credentials } = navigator as { credentials?: CredentialsContainer }
    return typeof credentials?.create === 'function' && typeof credentials.get === 'function'
}

function toAdminPasskey(item: {
    id: string
    friendly_name?: string
    created_at: string
    last_used_at?: string
}): AdminPasskey {
    return {
        id: item.id,
        friendly_name: item.friendly_name ?? null,
        created_at: item.created_at,
        last_used_at: item.last_used_at ?? null,
    }
}

/** Русские тексты для кодов WebAuthnError — остальные ошибки показываем как есть. */
const PASSKEY_ERROR_MESSAGES: Record<string, string> = {
    ERROR_CEREMONY_ABORTED: 'Операция с пасскеем отменена.',
    ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'Этот пасскей уже зарегистрирован.',
    ERROR_INVALID_DOMAIN: 'Пасскеи не работают на этом домене.',
    ERROR_INVALID_RP_ID: 'Пасскей выдан для другого сайта.',
    ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT: 'Устройство не умеет хранить пасскеи.',
    ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT: 'Устройство не поддерживает проверку пользователя.',
}

/** Человеко-читаемый текст ошибки пасскея (по коду WebAuthnError, иначе — сообщение SDK). */
export function passkeyErrorMessage(error: unknown): string {
    const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : ''
    return PASSKEY_ERROR_MESSAGES[code] ?? (error instanceof Error ? error.message : String(error))
}

/** Ошибку SDK превращаем в Error с человеко-читаемым текстом. */
function fail(label: string, error: unknown): never {
    console.error(`${label}:`, error)
    throw new Error(passkeyErrorMessage(error))
}

/**
 * Вход по пасскею: полная WebAuthn-церемония (challenge → navigator.credentials.get → verify).
 * При успехе SDK сам сохраняет сессию и эмитит SIGNED_IN, поэтому `useAdminAuth` подхватит вход.
 */
export async function signInWithPasskey(): Promise<void> {
    const { error } = await requireSupabase().auth.signInWithPasskey()
    if (error) fail('signInWithPasskey', error)
}

/** Пасскеи текущего пользователя. */
export async function listPasskeys(): Promise<AdminPasskey[]> {
    const { data, error } = await requireSupabase().auth.passkey.list()
    if (error) fail('listPasskeys', error)
    return data.map(toAdminPasskey)
}

/**
 * Регистрирует новый пасскей для текущей сессии.
 * Имя SDK задать при регистрации не даёт, поэтому непустое `friendlyName`
 * применяем вторым запросом (PATCH /passkeys/:id).
 */
export async function registerPasskey(friendlyName?: string): Promise<AdminPasskey> {
    const client = requireSupabase()
    const { data, error } = await client.auth.registerPasskey()
    if (error) fail('registerPasskey', error)

    const name = friendlyName?.trim() ?? ''
    if (name.length > 0) {
        const { data: updated, error: updateError } = await client.auth.passkey.update({
            passkeyId: data.id,
            friendlyName: name,
        })
        if (updateError) fail('registerPasskey:rename', updateError)
        return toAdminPasskey(updated)
    }
    return toAdminPasskey(data)
}

export async function renamePasskey(passkeyId: string, friendlyName: string): Promise<AdminPasskey> {
    const { data, error } = await requireSupabase().auth.passkey.update({ passkeyId, friendlyName })
    if (error) fail('renamePasskey', error)
    return toAdminPasskey(data)
}

export async function deletePasskey(passkeyId: string): Promise<void> {
    const { error } = await requireSupabase().auth.passkey.delete({ passkeyId })
    if (error) fail('deletePasskey', error)
}
