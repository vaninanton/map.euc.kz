-- Агрегированная статистика для админ-дашборда (/admin).
-- Один RPC вместо десятка запросов с клиента; тяжёлые агрегации по
-- telegram_locations выполняются на сервере (индексы по created_at).
-- Доступ только администраторам (map_admin_users) — внутри SECURITY DEFINER.
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- Границы периодов считаем по полуночи Алматы (UTC+5, без DST),
    -- сравнение по created_at остаётся index-friendly (timestamptz >= константа).
    almaty_midnight timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Almaty') AT TIME ZONE 'Asia/Almaty';
    result jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Доступ только для администраторов' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'points', (
            SELECT jsonb_build_object(
                'total', count(*),
                'sockets', count(*) FILTER (WHERE type = 'socket'),
                'meetings', count(*) FILTER (WHERE flag_is_meeting),
                'disabled', count(*) FILTER (WHERE flag_disabled)
            )
            FROM map_points
        ),
        'routes', (
            SELECT jsonb_build_object(
                'total', count(*),
                'disabled', count(*) FILTER (WHERE flag_disabled)
            )
            FROM map_routes
        ),
        'photos_total', (SELECT count(*) FROM map_point_photos),
        'events', (
            SELECT jsonb_build_object(
                'total', count(*),
                'disabled', count(*) FILTER (WHERE flag_disabled)
            )
            FROM map_events
        ),
        'upcoming_event_dates', (
            SELECT count(*)
            FROM map_event_dates d
            JOIN map_events e ON e.id = d.event_id
            WHERE NOT d.cancelled AND NOT e.flag_disabled AND d.starts_at >= now()
        ),
        'next_event_starts_at', (
            SELECT min(d.starts_at)
            FROM map_event_dates d
            JOIN map_events e ON e.id = d.event_id
            WHERE NOT d.cancelled AND NOT e.flag_disabled AND d.starts_at >= now()
        ),
        'participants_total', (SELECT count(*) FROM map_event_participants),
        'news_total', (SELECT count(*) FROM map_news WHERE deleted_at IS NULL),
        'submissions_pending', (SELECT count(*) FROM map_points_submissions WHERE status = 'pending'),
        'chats_enabled', (SELECT count(*) FROM telegram_chats WHERE enabled),
        'outbound_errors_30d', (
            SELECT count(*)
            FROM telegram_outbound_messages
            WHERE send_error IS NOT NULL AND created_at >= now() - interval '30 days'
        ),
        'last_location_at', (SELECT max(created_at) FROM telegram_locations),
        'riders', jsonb_build_object(
            'today', (
                SELECT count(DISTINCT telegram_user_id) FROM telegram_locations
                WHERE created_at >= almaty_midnight
            ),
            'week', (
                SELECT count(DISTINCT telegram_user_id) FROM telegram_locations
                WHERE created_at >= almaty_midnight - interval '6 days'
            ),
            'month', (
                SELECT count(DISTINCT telegram_user_id) FROM telegram_locations
                WHERE created_at >= almaty_midnight - interval '29 days'
            ),
            'year', (
                SELECT count(DISTINCT telegram_user_id) FROM telegram_locations
                WHERE created_at >= almaty_midnight - interval '364 days'
            )
        ),
        'daily_activity', (
            SELECT COALESCE(
                jsonb_agg(jsonb_build_object('day', day, 'riders', riders, 'locations', locations) ORDER BY day),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    ((tl.created_at AT TIME ZONE 'Asia/Almaty')::date)::text AS day,
                    count(DISTINCT tl.telegram_user_id) AS riders,
                    count(*) AS locations
                FROM telegram_locations tl
                WHERE tl.created_at >= almaty_midnight - interval '29 days'
                GROUP BY 1
            ) t
        )
    )
    INTO result;

    RETURN result;
END;
$$;

-- Только аутентифицированные (проверка на админа — внутри функции)
REVOKE ALL ON FUNCTION get_admin_dashboard_stats() FROM public;
REVOKE ALL ON FUNCTION get_admin_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;
