import { listSitemapEntries, type OgEnv } from './_lib/entities'
import { buildSitemapXml, type SitemapEntry } from './_lib/sitemap'

/** Сколько краулеры могут держать карту сайта. Час — как и дамп, из которого она строится. */
const SITEMAP_CACHE_SECONDS = 3600

const SITE_ORIGIN = 'https://map.euc.kz'

/** Статические разделы SPA. Админка и страницы райдеров в карту не идут. */
const STATIC_ENTRIES: SitemapEntry[] = [
    { path: '/', priority: '1.0' },
    { path: '/events', priority: '0.8' },
    { path: '/radar', priority: '0.5' },
    { path: '/help', priority: '0.5' },
]

/**
 * Карта сайта: статические разделы + все точки, маршруты, велодорожки и события.
 * Собирается на лету из того же часового дампа, что и OG-теги, поэтому точка,
 * добавленная в админке, попадает в sitemap без деплоя.
 */
export const onRequestGet: PagesFunction<OgEnv> = async (context) => {
    const paths = await listSitemapEntries(context.env, (promise) => {
        context.waitUntil(promise)
    })
    const entries = [...STATIC_ENTRIES, ...paths.map((path) => ({ path, priority: '0.7' }))]

    return new Response(buildSitemapXml(SITE_ORIGIN, entries), {
        headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': `public, max-age=${String(SITEMAP_CACHE_SECONDS)}`,
        },
    })
}
