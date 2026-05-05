import type { AdminMapRoute, MapRouteInput } from '@/admin/lib/adminApi/types'
import { db, runManyParsed, runOneParsed } from '@/admin/lib/adminApi/query'
import { parseAdminMapRoute } from '@/admin/lib/adminApi/parsers'

/** Возвращает список маршрутов для админки в алфавитном порядке. */
export async function listRoutes(): Promise<AdminMapRoute[]> {
    return runManyParsed(
        'listRoutes',
        db().from('map_routes').select('*').order('title', { ascending: true }),
        (raw) => parseAdminMapRoute(raw),
    )
}

/** Загружает один маршрут по id с runtime-валидацией ответа. */
export async function getRoute(id: number): Promise<AdminMapRoute> {
    return runOneParsed(
        'getRoute',
        db().from('map_routes').select('*').eq('id', id).single(),
        parseAdminMapRoute,
    )
}

/** Создаёт новый маршрут и возвращает сохранённую запись. */
export async function createRoute(input: MapRouteInput): Promise<AdminMapRoute> {
    return runOneParsed(
        'createRoute',
        db().from('map_routes').insert(input).select('*').single(),
        parseAdminMapRoute,
    )
}

/** Обновляет существующий маршрут по id и возвращает актуальную запись. */
export async function updateRoute(id: number, input: Partial<MapRouteInput>): Promise<AdminMapRoute> {
    return runOneParsed(
        'updateRoute',
        db().from('map_routes').update(input).eq('id', id).select('*').single(),
        parseAdminMapRoute,
    )
}

/** Быстрый переключатель флага скрытия маршрута на карте. */
export async function toggleRouteDisabled(id: number, disabled: boolean): Promise<void> {
    const { error } = await db().from('map_routes').update({ flag_disabled: disabled }).eq('id', id)
    if (error) {
        console.error('toggleRouteDisabled:', error)
        throw new Error(error.message)
    }
}

/** Удаляет маршрут из `map_routes` по id. */
export async function deleteRoute(id: number): Promise<void> {
    const { error } = await db().from('map_routes').delete().eq('id', id)
    if (error) {
        console.error('deleteRoute:', error)
        throw new Error(error.message)
    }
}
