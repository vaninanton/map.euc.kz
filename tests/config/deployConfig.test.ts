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

    it('канонизация pages.dev идёт раньше SPA-фолбэка', () => {
        const canonical = lines.findIndex((line) => line.startsWith('https://map-euc.pages.dev/*'))
        const fallback = lines.indexOf('/* /index.html 200')
        expect(canonical).toBeGreaterThanOrEqual(0)
        expect(canonical).toBeLessThan(fallback)
    })

    it('имя Pages-проекта совпадает с --project-name в deploy.yml', () => {
        const workflow = readRepoFile('.github/workflows/deploy.yml')
        const projectName = /--project-name=([\w-]+)/.exec(workflow)?.[1]
        expect(projectName).toBeDefined()
        expect(lines.some((line) => line.includes(`https://${String(projectName)}.pages.dev/*`))).toBe(true)
    })

    it('динамических правил не больше лимита Cloudflare (100)', () => {
        expect(lines.filter((line) => line.includes('*') || line.includes(':')).length).toBeLessThanOrEqual(100)
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
