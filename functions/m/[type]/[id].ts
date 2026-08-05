import { resolveEntity, type OgEnv } from '../../_lib/entities'
import { buildOgMeta } from '../../_lib/ogMeta'

/** Нормализация типа из deep-link в тип сущности (как в src/utils/hashNav.ts). */
const NORMALIZED_TYPE: Record<string, string> = {
    point: 'point',
    socket: 'socket',
    route: 'route',
    bikelane: 'bikeLane',
    telegramuser: 'telegramUser',
}

const FALLBACK_DESCRIPTION = 'Планируй поездки, смотри маршруты и розетки'

/** MIME фотографии по расширению — часть парсеров смотрит на og:image:type. */
function imageMimeType(url: string): string {
    return /\.png(\?|$)/i.test(url) ? 'image/png' : 'image/jpeg'
}

/** Подменяет содержимое тега: у <meta> — атрибут content, у <title> — текст. */
function setContent(value: string) {
    return {
        element(element: { setAttribute: (name: string, value: string) => void }) {
            element.setAttribute('content', value)
        },
    }
}

/**
 * Динамические OG-метатеги для ссылок вида /m/point/11, /m/route/5, /m/bikelane/62.
 *
 * Зачем функция: краулеры Telegram, WhatsApp и VK не исполняют JS, поэтому
 * заголовок из React они не увидят — разметку нужно подменить на сервере.
 * Страница при этом остаётся тем же SPA-бандлом: `next()` отдаёт index.html
 * (SPA-фолбэк из _redirects), а HTMLRewriter правит только теги в <head>.
 */
export const onRequestGet: PagesFunction<OgEnv> = async (context) => {
    const response = await context.next()

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return response

    const type = NORMALIZED_TYPE[String(context.params.type).toLowerCase()]
    const id = String(context.params.id)
    // Райдеры и неизвестные типы — оставляем дефолтную мету из index.html.
    if (!type || type === 'telegramUser') return response

    const entity = await resolveEntity(type, id, context.env)
    if (!entity) return response

    const meta = buildOgMeta(entity, FALLBACK_DESCRIPTION)
    const canonicalUrl = new URL(context.request.url)
    canonicalUrl.search = ''

    let rewriter = new HTMLRewriter()
        .on('title', {
            element(element) {
                element.setInnerContent(meta.title)
            },
        })
        .on('meta[property="og:title"]', setContent(meta.title))
        .on('meta[name="twitter:title"]', setContent(meta.title))
        .on('meta[property="og:description"]', setContent(meta.description))
        .on('meta[name="twitter:description"]', setContent(meta.description))
        .on('meta[name="description"]', setContent(meta.description))
        .on('meta[property="og:url"]', setContent(canonicalUrl.toString()))
        .on('meta[property="og:type"]', setContent('article'))

    if (meta.image) {
        const image = meta.image
        rewriter = rewriter
            .on('meta[property="og:image"]', setContent(image))
            .on('meta[property="og:image:secure_url"]', setContent(image))
            .on('meta[property="og:image:type"]', setContent(imageMimeType(image)))
            .on('meta[name="twitter:image"]', setContent(image))
            // Размеры дефолтной картинки к фото точки не относятся: краулер,
            // поверивший 1200×630, обрежет превью не по делу.
            .on('meta[property="og:image:width"]', {
                element(element) {
                    element.remove()
                },
            })
            .on('meta[property="og:image:height"]', {
                element(element) {
                    element.remove()
                },
            })
            .on('meta[property="og:image:alt"]', setContent(meta.title))
    }

    return rewriter.transform(response)
}
