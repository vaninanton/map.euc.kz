import { describe, it, expect } from 'vitest'
import { buildSitemapXml, escapeXml } from './sitemap'

const ORIGIN = 'https://map.euc.kz'

describe('escapeXml', () => {
    it('экранирует спецсимволы', () => {
        expect(escapeXml('a&b<c>d"e')).toBe('a&amp;b&lt;c&gt;d&quot;e')
    })
})

describe('buildSitemapXml', () => {
    it('строит валидный документ с абсолютными адресами', () => {
        const xml = buildSitemapXml(ORIGIN, [
            { path: '/', priority: '1.0' },
            { path: '/m/point/11', priority: '0.7' },
        ])
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
        expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
        expect(xml).toContain('<loc>https://map.euc.kz/m/point/11</loc>')
        expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
    })

    it('выбрасывает дубли: путь может приехать и из статики, и из дампа', () => {
        const xml = buildSitemapXml(ORIGIN, [
            { path: '/events', priority: '0.8' },
            { path: '/events', priority: '0.7' },
        ])
        expect(xml.match(/<loc>/g)).toHaveLength(1)
    })

    it('экранирует адрес с амперсандом', () => {
        const xml = buildSitemapXml(ORIGIN, [{ path: '/m/point/1?a=1&b=2', priority: '0.7' }])
        expect(xml).toContain('&amp;b=2')
        expect(xml).not.toMatch(/[^&]&b=2/)
    })

    it('пустой список даёт валидный пустой документ', () => {
        const xml = buildSitemapXml(ORIGIN, [])
        expect(xml).toContain('<urlset')
        expect(xml).not.toContain('<url>')
    })
})
