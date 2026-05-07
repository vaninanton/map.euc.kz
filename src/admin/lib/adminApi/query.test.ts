import type { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { runManyParsed, runManyRaw, runOneParsed, runOneRaw } from '@/admin/lib/adminApi/query'

function ok(data: unknown) {
    return Promise.resolve({ data, error: null })
}

function fail(message: string) {
    return Promise.resolve({
        data: null,
        error: { message } as PostgrestError,
    })
}

describe('adminApi query adapters', () => {
    it('runOneRaw возвращает одну запись и отклоняет пустой ответ', async () => {
        await expect(runOneRaw('getPoint', ok({ id: 1 }))).resolves.toEqual({ id: 1 })
        await expect(runOneRaw('getPoint', ok(null))).rejects.toThrow('getPoint: пустой ответ')
    })

    it('runManyRaw нормализует null в пустой список и отклоняет не-массив', async () => {
        await expect(runManyRaw('listPoints', ok(null))).resolves.toEqual([])
        await expect(runManyRaw('listPoints', ok([{ id: 1 }]))).resolves.toEqual([{ id: 1 }])
        await expect(runManyRaw('listPoints', ok({ id: 1 }))).rejects.toThrow('listPoints: ожидался массив записей')
    })

    it('пробрасывает ошибки Supabase без попытки парсинга', async () => {
        const parse = vi.fn()

        await expect(runOneParsed('updateRoute', fail('RLS denied'), parse)).rejects.toThrow('RLS denied')

        expect(parse).not.toHaveBeenCalled()
    })

    it('runManyParsed добавляет индекс строки к ошибке runtime-валидации', async () => {
        await expect(
            runManyParsed('listRoutes', ok([{ id: 1 }, { broken: true }]), (raw) => {
                if (typeof raw === 'object' && raw !== null && 'id' in raw) return raw
                throw new Error('id')
            }),
        ).rejects.toThrow('listRoutes[1]: неожиданная форма записи (id)')
    })
})
