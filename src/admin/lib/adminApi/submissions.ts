import type { AdminMapPoint, AdminSubmission, SubmissionStatus } from '@/admin/lib/adminApi/types'
import { db, runManyParsed, runOneParsed } from '@/admin/lib/adminApi/query'
import { parseAdminSubmission } from '@/admin/lib/adminApi/parsers'
import { createPoint } from '@/admin/lib/adminApi/points'

/** Нормализует координаты заявки в tuple `[lng, lat]`. */
function asPointCoordinatesFromSubmission(value: unknown): [number, number] {
    if (!Array.isArray(value) || value.length < 2) {
        throw new Error('Некорректные координаты в заявке')
    }
    const lng = Number(value[0])
    const lat = Number(value[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error('Некорректные координаты в заявке')
    }
    return [lng, lat]
}

/** Возвращает список заявок на модерацию (опционально с фильтром по статусу). */
export async function listSubmissions(status?: SubmissionStatus): Promise<AdminSubmission[]> {
    let query = db()
        .from('map_points_submissions')
        .select('*')
        .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    return runManyParsed('listSubmissions', query, (raw) => parseAdminSubmission(raw))
}

/**
 * Подтверждает заявку:
 * создаёт точку в `map_points` и помечает заявку как `approved`.
 */
export async function approveSubmission(id: string): Promise<AdminMapPoint> {
    const sub = await runOneParsed(
        'approveSubmission:fetch',
        db().from('map_points_submissions').select('*').eq('id', id).single(),
        parseAdminSubmission,
    )
    if (sub.status !== 'pending') {
        throw new Error('Заявка уже обработана.')
    }

    const coordinates = asPointCoordinatesFromSubmission(sub.coordinates)

    const inserted = await createPoint({
        type: sub.type,
        title: sub.title,
        description: sub.description,
        coordinates,
        flag_is_meeting: sub.type === 'point' ? sub.flag_is_meeting : false,
        flag_has_socket: sub.type === 'socket',
        flag_erlan: false,
        flag_disabled: false,
    })

    const { error } = await db()
        .from('map_points_submissions')
        .update({ status: 'approved', processed_at: new Date().toISOString() })
        .eq('id', id)
    if (error) {
        console.error('approveSubmission:update', error)
        throw new Error(error.message)
    }

    return inserted
}

/** Отклоняет заявку, если она ещё `pending`. */
export async function rejectSubmission(id: string): Promise<void> {
    const { error } = await db()
        .from('map_points_submissions')
        .update({ status: 'rejected', processed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending')
    if (error) {
        console.error('rejectSubmission:', error)
        throw new Error(error.message)
    }
}
