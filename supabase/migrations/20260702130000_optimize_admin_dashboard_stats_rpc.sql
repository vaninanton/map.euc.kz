-- Оптимизация get_admin_dashboard_stats():
-- telegram_locations — самая объёмная таблица (пинг на каждую геопозицию).
-- Прежняя версия сканировала её 5 раз: today/week/month/year (count DISTINCT)
-- + daily_activity (GROUP BY за 30 дней). Диапазоны пересекались.
--
-- Здесь окно за 30 дней читается ОДНИМ сканом (CTE recent) и переиспользуется:
--   - today/week/month — FILTER-агрегаты count(DISTINCT ...) поверх recent;
--   - daily_activity   — GROUP BY поверх того же recent.
-- Отдельным (широким) сканом остаётся только year.
-- Итого: 5 сканов telegram_locations → 2.

-- Индекс под диапазон по created_at, покрывающий telegram_user_id.
-- EXPLAIN на проде показал: без него планировщик брал telegram_locations_user_id_created_at_idx
-- (ведущая колонка telegram_user_id), из-за чего условие «created_at >= const» шло не как
-- узкий range-scan, а как проход почти по всему индексу с Heap Fetches: ~22 700 и внешней
-- сортировкой на диск. Индекс (created_at, telegram_user_id) даёт узкий Index Only Scan:
-- диапазон по ведущей created_at + вторая колонка покрывает count(DISTINCT ...) без обращения к куче.
-- Обычный (не CONCURRENTLY) CREATE INDEX: миграции db push идут в транзакции, а объём таблицы
-- невелик (~100k строк) — блокировка записи пренебрежимо мала.
CREATE INDEX IF NOT EXISTS telegram_locations_created_at_user_id_idx
    ON telegram_locations (created_at, telegram_user_id);

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
    month_start timestamptz := almaty_midnight - interval '29 days';
    week_start timestamptz := almaty_midnight - interval '6 days';
    result jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Доступ только для администраторов' USING ERRCODE = '42501';
    END IF;

    WITH recent AS MATERIALIZED (
        -- Один скан 30-дневного окна telegram_locations для riders + daily_activity.
        -- MATERIALIZED обязателен: иначе планировщик заинлайнит CTE в оба потребителя
        -- (riders_30d и daily) и сделает ДВА скана таблицы вместо одного.
        SELECT
            tl.telegram_user_id,
            tl.created_at,
            (tl.created_at AT TIME ZONE 'Asia/Almaty')::date AS local_day
        FROM telegram_locations tl
        WHERE tl.created_at >= month_start
    ),
    riders_30d AS (
        SELECT
            count(DISTINCT telegram_user_id) FILTER (WHERE created_at >= almaty_midnight) AS today,
            count(DISTINCT telegram_user_id) FILTER (WHERE created_at >= week_start) AS week,
            count(DISTINCT telegram_user_id) AS month
        FROM recent
    ),
    daily AS (
        SELECT
            local_day::text AS day,
            count(DISTINCT telegram_user_id) AS riders,
            count(*) AS locations
        FROM recent
        GROUP BY local_day
    )
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
            'today', (SELECT today FROM riders_30d),
            'week', (SELECT week FROM riders_30d),
            'month', (SELECT month FROM riders_30d),
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
            FROM daily
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
