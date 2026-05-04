/** Дата/время для таблиц админки (локаль ru-RU). */
export function formatAdminDate(value: string): string {
    return new Date(value).toLocaleString('ru-RU')
}
