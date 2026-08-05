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
 * Описание: текст из карточки, иначе — собранное из деталей,
 * иначе — общая подпись проекта (пустая мета хуже дефолтной).
 */
export function buildDescription(entity: MapEntity, fallback: string): string {
    const own = entity.description?.trim()
    if (own) return truncate(own)
    const details = (entity.details ?? []).filter((part) => part.trim().length > 0)
    if (details.length > 0) return truncate(details.join(' · '))
    return fallback
}

export function buildOgMeta(entity: MapEntity, fallbackDescription: string): OgMeta {
    return {
        title: buildTitle(entity),
        description: buildDescription(entity, fallbackDescription),
        image: entity.image ?? undefined,
    }
}

/** Публичный URL файла в Supabase Storage. */
export function storagePublicUrl(supabaseUrl: string, bucket: string, path: string): string {
    const encodedPath = path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
    return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`
}
