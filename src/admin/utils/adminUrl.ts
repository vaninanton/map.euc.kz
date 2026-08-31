/**
 * Абсолютный адрес страницы админки — для `redirectTo` в письмах и OAuth.
 * Он же должен быть в Redirect URLs проекта Supabase, иначе GoTrue вернёт на Site URL.
 */
export function adminUrl(subpath = ''): string {
    return `${window.location.origin}${import.meta.env.BASE_URL}admin${subpath}`
}
