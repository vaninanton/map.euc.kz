import { describe, it, expect } from 'vitest'
import {
    buildDescription,
    buildJsonLd,
    buildOgMeta,
    buildTitle,
    storagePublicUrl,
    truncate,
    type MapEntity,
} from './ogMeta'

const FALLBACK = 'Планируй поездки, смотри маршруты и розетки'

describe('buildTitle', () => {
    it('подписывает тип по-русски, чтобы ссылка читалась без контекста', () => {
        expect(buildTitle({ type: 'point', name: 'Смотровая площадка' })).toBe('Смотровая площадка — точка на карте')
        expect(buildTitle({ type: 'route', name: 'Медео' })).toBe('Медео — маршрут на карте')
        expect(buildTitle({ type: 'bikeLane', name: 'улица Валиханова' })).toBe(
            'улица Валиханова — велодорожка на карте',
        )
        expect(buildTitle({ type: 'socket', name: 'ТЦ Форум' })).toBe('ТЦ Форум — розетка на карте')
    })

    it('для неизвестного типа отдаёт голое название', () => {
        expect(buildTitle({ type: 'unknown', name: 'Что-то' })).toBe('Что-то')
    })

    it('обрезает пробелы по краям названия', () => {
        expect(buildTitle({ type: 'route', name: '  Медео  ' })).toBe('Медео — маршрут на карте')
    })
})

describe('truncate', () => {
    it('короткий текст не трогает', () => {
        expect(truncate('Вид на город')).toBe('Вид на город')
    })

    it('схлопывает переводы строк и лишние пробелы', () => {
        expect(truncate('Вид\n\nна   город')).toBe('Вид на город')
    })

    it('режет по границе слова и ставит многоточие', () => {
        const result = truncate('раз два три четыре пять шесть', 12)
        expect(result).toBe('раз два три…')
    })

    it('слово длиннее лимита режет жёстко', () => {
        expect(truncate('ааааааааааааааааааааа', 10)).toBe('аааааааааа…')
    })
})

describe('buildDescription', () => {
    it('короткое описание дополняет контекстом проекта до длины сниппета', () => {
        const result = buildDescription({ type: 'point', name: 'x', description: 'Вид на город' }, FALLBACK)
        expect(result).toMatch(/^Вид на город\. Мономаршруты/)
        // Поисковики показывают 110–160 символов; ради этого хвост и добавляется.
        expect(result.length).toBeGreaterThanOrEqual(110)
        expect(result.length).toBeLessThanOrEqual(200)
    })

    it('длинное описание оставляет как есть', () => {
        const long = 'Длинное описание точки. '.repeat(6).trim()
        expect(buildDescription({ type: 'point', name: 'x', description: long }, FALLBACK)).not.toContain(
            'Мономаршруты —',
        )
    })

    it('не удваивает точку на стыке с хвостом', () => {
        const result = buildDescription({ type: 'point', name: 'x', description: 'Вид на город.' }, FALLBACK)
        expect(result).not.toContain('..')
    })

    it('без описания собирает детали через разделитель', () => {
        const entity: MapEntity = {
            type: 'bikeLane',
            name: 'x',
            details: ['Полоса с боллардами', '0.69 км', 'покрытие: средне'],
        }
        expect(buildDescription(entity, FALLBACK)).toMatch(/^Полоса с боллардами · 0\.69 км · покрытие: средне\./)
    })

    it('без описания и деталей отдаёт общий текст проекта', () => {
        expect(buildDescription({ type: 'route', name: 'x' }, FALLBACK)).toBe(FALLBACK)
        expect(buildDescription({ type: 'route', name: 'x', description: '   ' }, FALLBACK)).toBe(FALLBACK)
    })
})

describe('buildOgMeta', () => {
    it('собирает заголовок, описание и картинку', () => {
        const meta = buildOgMeta(
            { type: 'point', name: 'Парк Горького', description: 'Вход со стороны реки', image: 'https://x/p.jpg' },
            FALLBACK,
        )
        expect(meta.title).toBe('Парк Горького — точка на карте')
        expect(meta.description).toMatch(/^Вход со стороны реки\./)
        expect(meta.image).toBe('https://x/p.jpg')
    })

    it('без фото оставляет image пустым — сработает дефолтная картинка из index.html', () => {
        expect(buildOgMeta({ type: 'route', name: 'Медео', image: null }, FALLBACK).image).toBeUndefined()
    })
})

describe('buildJsonLd', () => {
    const meta = { title: 'Парк — точка на карте', description: 'Описание' }

    it('точка с координатами описывается как Place с GeoCoordinates', () => {
        const entity: MapEntity = { type: 'point', name: 'Парк', geo: { lon: 76.9, lat: 43.2 } }
        const json = JSON.parse(buildJsonLd(entity, meta, 'https://map.euc.kz/m/point/11')) as Record<string, unknown>
        expect(json['@type']).toBe('Place')
        expect(json.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 43.2, longitude: 76.9 })
        expect(json.url).toBe('https://map.euc.kz/m/point/11')
    })

    it('без координат остаётся WebPage', () => {
        const json = JSON.parse(
            buildJsonLd({ type: 'route', name: 'Медео' }, meta, 'https://map.euc.kz/m/route/5'),
        ) as {
            '@type': string
            geo?: unknown
        }
        expect(json['@type']).toBe('WebPage')
        expect(json.geo).toBeUndefined()
    })

    it('экранирует < — иначе название закрыло бы тег script', () => {
        const entity: MapEntity = { type: 'route', name: 'x' }
        const json = buildJsonLd(entity, { title: '</script><b>', description: 'd' }, 'https://map.euc.kz/')
        expect(json).not.toContain('</script>')
        expect(json).toContain('\\u003c')
    })
})

describe('storagePublicUrl', () => {
    it('строит публичный URL файла', () => {
        expect(storagePublicUrl('https://p.supabase.co', 'map-point-photos', '48_0.jpg')).toBe(
            'https://p.supabase.co/storage/v1/object/public/map-point-photos/48_0.jpg',
        )
    })

    it('терпит слэш на конце и экранирует сегменты пути', () => {
        expect(storagePublicUrl('https://p.supabase.co/', 'bucket', 'папка/файл 1.jpg')).toBe(
            'https://p.supabase.co/storage/v1/object/public/bucket/%D0%BF%D0%B0%D0%BF%D0%BA%D0%B0/%D1%84%D0%B0%D0%B9%D0%BB%201.jpg',
        )
    })
})
