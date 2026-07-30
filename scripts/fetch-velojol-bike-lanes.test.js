import { describe, it, expect } from 'vitest'
import { normalizeName, mergeGroups } from './fetch-velojol-bike-lanes.js'

describe('normalizeName (velojol → название велодорожки)', () => {
    it('переводит казахские названия по словарю', () => {
        expect(normalizeName('Манас көшесі')).toBe('улица Манаса')
        expect(normalizeName('Жібек Жолы даңғылы')).toBe('проспект Жибек Жолы')
        expect(normalizeName('Қонаев көшесі')).toBe('улица Конаева')
    })

    it('переставляет тип улицы вперёд — velojol пишет его и до, и после названия', () => {
        expect(normalizeName('Абая проспект')).toBe('проспект Абая')
        expect(normalizeName('Проспект Абая')).toBe('проспект Абая')
        expect(normalizeName('проспект Абая')).toBe('проспект Абая')
        expect(normalizeName('Гоголя улица')).toBe('улица Гоголя')
        expect(normalizeName('улица Гоголя')).toBe('улица Гоголя')
    })

    it('сводит разнобой одной улицы к одному названию', () => {
        const variants = ['Абая проспект', 'Проспект Абая', 'проспект Абая']
        expect(new Set(variants.map(normalizeName)).size).toBe(1)
    })

    it('не ломает названия с числом или уточнением в хвосте', () => {
        expect(normalizeName('Жумбаева 100 улица')).toBe('улица Жумбаева 100')
        expect(normalizeName('Макатаева (Акбулак-2)')).toBe('Макатаева (Акбулак-2)')
    })

    it('не трогает типы, где перестановка ломает название', () => {
        expect(normalizeName('Ташкентский тракт')).toBe('Ташкентский тракт')
        expect(normalizeName('Желтоксан парк')).toBe('Желтоксан парк')
        expect(normalizeName('Сквер имени С. Сейфуллина')).toBe('Сквер имени С. Сейфуллина')
    })

    it('оставляет как есть названия-заглушки и одиночные слова', () => {
        expect(normalizeName('Велодорожка №1026')).toBe('Велодорожка №1026')
        expect(normalizeName('Атакент')).toBe('Атакент')
    })

    it('схлопывает лишние пробелы и терпит пустой title', () => {
        expect(normalizeName('  Гоголя   улица ')).toBe('улица Гоголя')
        expect(normalizeName(undefined)).toBe('')
        expect(normalizeName(null)).toBe('')
    })
})

/** Сегмент-заготовка: координаты идут на север с шагом ~11 м на 0.0001°. */
function makeSegment(id, coordinates, overrides = {}) {
    return {
        id,
        name: `Велодорожка №${String(id)}`,
        laneType: 'separated',
        laneTypeLabel: 'Обособленная велодорожка',
        distance: 0.1,
        description: `Описание ${String(id)}`,
        quality: 4,
        qualityLabel: 'Хорошо',
        coordinates,
        ...overrides,
    }
}

describe('mergeGroups (склейка кусков одной дорожки)', () => {
    const group = [{ name: 'улица Манаса', ids: [10, 20] }]

    it('склеивает куски в одну линию, суммирует длину и берёт данные первого куска', () => {
        const first = makeSegment(10, [
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const second = makeSegment(20, [
            [76.9, 43.2411],
            [76.9, 43.242],
        ])
        const { segments, mergedCount, consumedCount, warnings } = mergeGroups([first, second], group)

        expect(mergedCount).toBe(1)
        expect(consumedCount).toBe(2)
        expect(warnings).toEqual([])
        expect(segments).toHaveLength(1)
        const [merged] = segments
        expect(merged.id).toBe(10)
        expect(merged.name).toBe('улица Манаса')
        expect(merged.distance).toBe(0.2)
        expect(merged.description).toBe('Описание 10')
        expect(merged.qualityLabel).toBe('Хорошо')
        expect(merged.coordinates).toEqual([
            [76.9, 43.24],
            [76.9, 43.241],
            [76.9, 43.2411],
            [76.9, 43.242],
        ])
    })

    it('разворачивает первый кусок, если он стыкуется со вторым своим началом', () => {
        // Ловили на Роще Баума: голова смотрела «от» цепочки, и первый стык
        // давал разрыв 1304 м — карта рисовала прямую через полгорода.
        const head = makeSegment(10, [
            [76.9, 43.241],
            [76.9, 43.24],
        ])
        const second = makeSegment(20, [
            [76.9, 43.2411],
            [76.9, 43.242],
        ])
        const { segments, warnings } = mergeGroups([head, second], group)

        expect(warnings).toEqual([])
        expect(segments[0].coordinates).toEqual([
            [76.9, 43.24],
            [76.9, 43.241],
            [76.9, 43.2411],
            [76.9, 43.242],
        ])
    })

    it('разворачивает кусок, нарисованный в обратную сторону', () => {
        const first = makeSegment(10, [
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const reversed = makeSegment(20, [
            [76.9, 43.242],
            [76.9, 43.2411],
        ])
        const [merged] = mergeGroups([first, reversed], group).segments

        expect(merged.coordinates).toEqual([
            [76.9, 43.24],
            [76.9, 43.241],
            [76.9, 43.2411],
            [76.9, 43.242],
        ])
    })

    it('не дублирует точку, если куски стыкуются в одной координате', () => {
        const first = makeSegment(10, [
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const second = makeSegment(20, [
            [76.9, 43.241],
            [76.9, 43.242],
        ])
        const [merged] = mergeGroups([first, second], group).segments

        expect(merged.coordinates).toEqual([
            [76.9, 43.24],
            [76.9, 43.241],
            [76.9, 43.242],
        ])
    })

    it('предупреждает о большом разрыве — карта нарисует прямую через него', () => {
        const first = makeSegment(10, [
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const far = makeSegment(20, [
            [76.9, 43.26],
            [76.9, 43.261],
        ])
        const { warnings } = mergeGroups([first, far], group)

        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toContain('разрыв')
    })

    it('предупреждает о разных типах полос и оставляет тип первого куска', () => {
        const first = makeSegment(10, [
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const other = makeSegment(
            20,
            [
                [76.9, 43.241],
                [76.9, 43.242],
            ],
            { laneType: 'lane', laneTypeLabel: 'Полоса' },
        )
        const { segments, warnings } = mergeGroups([first, other], group)

        expect(segments[0].laneTypeLabel).toBe('Обособленная велодорожка')
        expect(warnings[0]).toContain('типы полос разные')
    })

    it('не падает, если кусок из группы исчез из velojol', () => {
        const only = makeSegment(10, [
            [76.9, 43.24],
            [76.9, 43.241],
        ])
        const { segments, mergedCount, warnings } = mergeGroups([only], group)

        expect(mergedCount).toBe(0)
        expect(segments).toEqual([only])
        expect(warnings.join(' ')).toContain('нет кусков 20')
    })

    it('не трогает сегменты вне групп', () => {
        const outsider = makeSegment(99, [
            [76.95, 43.3],
            [76.95, 43.301],
        ])
        const { segments } = mergeGroups([outsider], [])

        expect(segments).toEqual([outsider])
    })
})
