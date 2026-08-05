import { describe, it, expect } from 'vitest'
import { buildDescription, buildOgMeta, buildTitle, storagePublicUrl, truncate, type MapEntity } from './ogMeta'

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
    it('берёт описание сущности', () => {
        expect(buildDescription({ type: 'point', name: 'x', description: 'Вид на город' }, FALLBACK)).toBe(
            'Вид на город',
        )
    })

    it('без описания собирает детали через разделитель', () => {
        const entity: MapEntity = {
            type: 'bikeLane',
            name: 'x',
            details: ['Полоса с боллардами', '0.69 км', 'покрытие: средне'],
        }
        expect(buildDescription(entity, FALLBACK)).toBe('Полоса с боллардами · 0.69 км · покрытие: средне')
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
        expect(meta).toEqual({
            title: 'Парк Горького — точка на карте',
            description: 'Вход со стороны реки',
            image: 'https://x/p.jpg',
        })
    })

    it('без фото оставляет image пустым — сработает дефолтная картинка из index.html', () => {
        expect(buildOgMeta({ type: 'route', name: 'Медео', image: null }, FALLBACK).image).toBeUndefined()
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
