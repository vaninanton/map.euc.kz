import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

// Проверяем файлы в public/, а не в dist/: Vite копирует их побайтово, а `npm test`
// в pre-commit идёт до `npm run build` — на dist/ тест был бы недостоверным.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readRepoFile = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), 'utf8')

/** Значащие строки: без пустых и без комментариев. */
function meaningfulLines(content: string): string[] {
    return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
}

describe('public/_redirects', () => {
    const lines = meaningfulLines(readRepoFile('public/_redirects'))

    it('SPA-фолбэк отдаёт index.html со статусом 200', () => {
        expect(lines).toContain('/* /index.html 200')
    })

    it('SPA-фолбэк — последнее правило: после /* остальные недостижимы', () => {
        expect(lines.at(-1)).toBe('/* /index.html 200')
    })

    it('source у всех правил — путь: правила с полным URL Cloudflare игнорирует молча', () => {
        for (const line of lines) {
            expect(line.startsWith('/'), `правило «${line}» начинается не с пути`).toBe(true)
        }
    })

    it('динамических правил не больше лимита Cloudflare (100)', () => {
        expect(lines.filter((line) => line.includes('*') || line.includes(':')).length).toBeLessThanOrEqual(100)
    })
})

describe('index.html — метатеги по умолчанию', () => {
    const html = readRepoFile('index.html')

    /** Значение content у тега с указанным property/name. */
    function metaContent(attribute: 'property' | 'name', key: string): string | undefined {
        const pattern = new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`)
        return pattern.exec(html)?.[1]
    }

    it('og:url и og:image абсолютные — краулеры не резолвят относительные пути', () => {
        for (const key of ['og:url', 'og:image', 'og:logo']) {
            expect(metaContent('property', key), `${key} должен быть абсолютным`).toMatch(/^https:\/\/map\.euc\.kz\//)
        }
        expect(metaContent('name', 'twitter:image')).toMatch(/^https:\/\/map\.euc\.kz\//)
    })

    it('размеры картинки совпадают со стандартом карточки 1200×630', () => {
        expect(metaContent('property', 'og:image:width')).toBe('1200')
        expect(metaContent('property', 'og:image:height')).toBe('630')
    })

    it('есть og:image:secure_url и og:image:type — на них смотрят парсеры WhatsApp', () => {
        expect(metaContent('property', 'og:image:secure_url')).toBe(metaContent('property', 'og:image'))
        expect(metaContent('property', 'og:image:type')).toBe('image/png')
    })

    it('теги, которые подменяет функция, присутствуют в разметке', () => {
        // HTMLRewriter правит существующие теги, а не добавляет новые: если тег
        // пропадёт из index.html, подмена для /m/... молча перестанет работать.
        for (const key of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:alt']) {
            expect(metaContent('property', key), `нет тега ${key}`).toBeDefined()
        }
        for (const key of ['twitter:title', 'twitter:description', 'twitter:image']) {
            expect(metaContent('name', key), `нет тега ${key}`).toBeDefined()
        }
        expect(html).toMatch(/<title>[^<]+<\/title>/)
    })

    it('плейсхолдера %BASE_URL% не осталось — плагин base-url-meta удалён', () => {
        expect(html).not.toContain('%BASE_URL%')
    })
})

describe('public/_headers', () => {
    const content = readRepoFile('public/_headers')
    const lines = meaningfulLines(content)

    /** Заголовки секции: строки до следующего правила (правило начинается с / или http). */
    function sectionHeaders(rule: string): string[] {
        const start = lines.indexOf(rule)
        expect(start, `секция ${rule} не найдена`).toBeGreaterThanOrEqual(0)
        const rest = lines.slice(start + 1)
        const end = rest.findIndex((line) => line.startsWith('/') || line.startsWith('http'))
        return end === -1 ? rest : rest.slice(0, end)
    }

    it('хешированные бандлы кэшируются навсегда', () => {
        const headers = sectionHeaders('/assets/*').join('\n')
        expect(headers).toMatch(/Cache-Control:.*max-age=31536000/)
        expect(headers).toContain('immutable')
    })

    it('сервис-воркер не кэшируется', () => {
        const headers = sectionHeaders('/sw.js').join('\n')
        expect(headers).toMatch(/Cache-Control:.*no-cache/)
        expect(headers).not.toContain('immutable')
    })

    it('HTML всегда ревалидируется', () => {
        for (const rule of ['/', '/index.html']) {
            expect(sectionHeaders(rule).join('\n')).toMatch(/Cache-Control:.*max-age=0/)
        }
    })

    it('правил не больше лимита Cloudflare (100)', () => {
        expect(lines.filter((line) => line.startsWith('/') || line.startsWith('http')).length).toBeLessThanOrEqual(100)
    })
})
