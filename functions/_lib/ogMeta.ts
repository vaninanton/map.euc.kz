// Импорт из src/ относительным путём: alias `@/` знает Vite, но не esbuild,
// которым wrangler собирает functions/. Дублировать подписи типов нельзя —
// src/constants/index.ts единственный источник истины (и ни от чего не зависит).
import { FEATURE_TYPE_LABELS } from '../../src/constants'

/** Метатеги, которыми подменяется разметка index.html для конкретной ссылки. */
export interface OgMeta {
    title: string
    description: string
    /** Абсолютный URL картинки; пусто — оставить дефолтную из index.html. */
    image?: string
}

/** Сущность карты в том виде, в каком её отдают источники данных. */
export interface MapEntity {
    /** Тип из deep-link: point | socket | route | bikeLane. */
    type: string
    name: string
    description?: string | null
    image?: string | null
    /** Дополнительные детали для описания: «3.4 км», «Обособленная велодорожка». */
    details?: string[]
    /** Координаты точки — попадают в JSON-LD как GeoCoordinates. */
    geo?: { lon: number; lat: number } | null
}

const MAX_DESCRIPTION = 200

/**
 * Обрезает описание по границе слова и добавляет многоточие.
 * Краулеры всё равно показывают ~200 символов, а длинный текст в мете — мусор.
 */
export function truncate(text: string, maxLength = MAX_DESCRIPTION): string {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    const cut = normalized.slice(0, maxLength)
    const lastSpace = cut.lastIndexOf(' ')
    return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Заголовок вида «Смотровая площадка — точка на карте».
 * Тип подписывается по-русски, чтобы ссылка в чате читалась без контекста.
 */
export function buildTitle(entity: MapEntity): string {
    const label = FEATURE_TYPE_LABELS[entity.type]
    const name = entity.name.trim()
    if (!label) return name
    return `${name} — ${label.toLowerCase()} на карте`
}

/**
 * Хвост, которым дополняются короткие описания. Поисковики показывают 110–160
 * символов, а карточки вроде «Вид на город» столько не дают — контекст проекта
 * делает сниппет осмысленным, не выдумывая фактов про сам объект.
 */
const PROJECT_SUFFIX =
    'Мономаршруты — карта для райдеров на моноколёсах в Алматы: маршруты, розетки, места встреч и живые геопозиции.'

/** Ниже этой длины описание считаем слишком коротким для сниппета. */
const MIN_DESCRIPTION = 110

/**
 * Описание: текст из карточки, иначе — собранное из деталей,
 * иначе — общая подпись проекта (пустая мета хуже дефолтной).
 * Короткий текст дополняется контекстом проекта.
 */
export function buildDescription(entity: MapEntity, fallback: string): string {
    const own = entity.description?.trim()
    if (own) return truncate(withProjectContext(own))
    const details = (entity.details ?? []).filter((part) => part.trim().length > 0)
    if (details.length > 0) return truncate(withProjectContext(details.join(' · ')))
    return fallback
}

/** Дополняет текст подписью проекта, если он короче порога. */
function withProjectContext(text: string): string {
    if (text.length >= MIN_DESCRIPTION) return text
    return `${text.replace(/[.\s]+$/, '')}. ${PROJECT_SUFFIX}`
}

export function buildOgMeta(entity: MapEntity, fallbackDescription: string): OgMeta {
    return {
        title: buildTitle(entity),
        description: buildDescription(entity, fallbackDescription),
        image: entity.image ?? undefined,
    }
}

/**
 * JSON-LD страницы: у точки есть координаты — это schema.org/Place, у остальных
 * сущностей описывать нечего сверх WebPage. Возвращает готовый JSON-текст.
 * `<` экранируется, чтобы название с угловой скобкой не закрыло тег script.
 */
export function buildJsonLd(entity: MapEntity, meta: OgMeta, pageUrl: string): string {
    const base = {
        '@context': 'https://schema.org',
        '@type': entity.geo ? 'Place' : 'WebPage',
        name: meta.title,
        description: meta.description,
        url: pageUrl,
        ...(meta.image ? { image: meta.image } : {}),
        ...(entity.geo
            ? { geo: { '@type': 'GeoCoordinates', latitude: entity.geo.lat, longitude: entity.geo.lon } }
            : {}),
    }
    return JSON.stringify(base).replace(/</g, '\\u003c')
}

/** Публичный URL файла в Supabase Storage. */
export function storagePublicUrl(supabaseUrl: string, bucket: string, path: string): string {
    const encodedPath = path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
    return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`
}
