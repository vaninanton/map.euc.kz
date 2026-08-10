/** Запись карты сайта: путь от корня и приоритет обхода. */
export interface SitemapEntry {
    path: string
    priority: string
}

/** Экранирование для XML — в названиях и путях встречается всё что угодно. */
export function escapeXml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Карта сайта в формате sitemaps.org. Дубли отбрасываются: один и тот же путь
 * может приехать и из статического списка, и из дампа.
 */
export function buildSitemapXml(origin: string, entries: SitemapEntry[]): string {
    const seen = new Set<string>()
    const urls: string[] = []
    for (const entry of entries) {
        if (seen.has(entry.path)) continue
        seen.add(entry.path)
        urls.push(
            `<url><loc>${escapeXml(`${origin}${entry.path}`)}</loc><priority>${escapeXml(entry.priority)}</priority></url>`,
        )
    }
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls,
        '</urlset>',
        '',
    ].join('\n')
}
