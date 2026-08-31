/**
 * Разбор ошибки, с которой Supabase Auth возвращает браузер после OAuth-редиректа.
 * GoTrue кладёт её и в query, и во фрагмент: `/admin?error=…#error=…&sb=`.
 */

/** Понятные подписи для кодов, которые реально встречаются в наших сценариях. */
const ERROR_CODE_MESSAGES: Record<string, string> = {
    identity_already_exists:
        'Этот Telegram уже привязан к другому пользователю Supabase. Удалите тот аккаунт в Dashboard → Authentication → Users и повторите привязку.',
    // Manual linking выключен в настройках проекта — привязка недоступна.
    manual_linking_disabled: 'Привязка аккаунтов выключена в настройках Supabase Auth («Allow manual linking»).',
}

function pickError(params: URLSearchParams): string | null {
    const code = params.get('error_code')
    const description = params.get('error_description')
    if (!code && !description) return null
    if (code && code in ERROR_CODE_MESSAGES) return ERROR_CODE_MESSAGES[code]
    return description ?? code
}

/**
 * Достаёт сообщение об ошибке из адреса. Сначала фрагмент (implicit flow),
 * затем query — GoTrue дублирует, но фрагмент полнее.
 */
export function parseAuthRedirectError(url: { search: string; hash: string }): string | null {
    const fromHash = pickError(new URLSearchParams(url.hash.replace(/^#/, '')))
    if (fromHash) return fromHash
    return pickError(new URLSearchParams(url.search))
}

/** Адрес без служебных параметров ошибки — чтобы она не всплывала при перезагрузке. */
export function stripAuthRedirectError(url: { pathname: string; search: string; hash: string }): string {
    const keys = ['error', 'error_code', 'error_description', 'sb']
    const search = new URLSearchParams(url.search)
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    for (const key of keys) {
        search.delete(key)
        hash.delete(key)
    }
    const searchText = search.toString()
    const hashText = hash.toString()
    return `${url.pathname}${searchText ? `?${searchText}` : ''}${hashText ? `#${hashText}` : ''}`
}
