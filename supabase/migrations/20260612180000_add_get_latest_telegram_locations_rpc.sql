-- Возвращает последнюю точку каждого пользователя за указанный TTL,
-- обогащённую данными из telegram_profiles (аватар, имя).
-- Используется для быстрого первого рендера маркеров и радара.
CREATE OR REPLACE FUNCTION get_latest_telegram_locations(
  ttl_minutes integer DEFAULT 60,
  max_accuracy_meters double precision DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  chat_id bigint,
  chat_title text,
  telegram_user_id bigint,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  longitude double precision,
  latitude double precision,
  location_accuracy_meters double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      tl.id,
      tl.created_at,
      tl.chat_id,
      tl.chat_title,
      tl.telegram_user_id,
      COALESCE(tp.username, tl.username)    AS username,
      COALESCE(tp.first_name, tl.first_name) AS first_name,
      COALESCE(tp.last_name, tl.last_name)   AS last_name,
      tp.avatar_url,
      tl.longitude,
      tl.latitude,
      tl.location_accuracy_meters,
      ROW_NUMBER() OVER (
        PARTITION BY tl.telegram_user_id
        ORDER BY tl.created_at DESC, tl.id DESC
      ) AS rn
    FROM telegram_locations tl
    LEFT JOIN telegram_profiles tp USING (telegram_user_id)
    WHERE
      tl.created_at >= now() - (ttl_minutes || ' minutes')::interval
      AND (
        tl.location_accuracy_meters IS NULL
        OR tl.location_accuracy_meters <= max_accuracy_meters
      )
  )
  SELECT
    id, created_at, chat_id, chat_title, telegram_user_id,
    username, first_name, last_name, avatar_url,
    longitude, latitude, location_accuracy_meters
  FROM ranked
  WHERE rn = 1
  ORDER BY created_at DESC;
$$;

-- Публичный доступ (читают все, как и telegram_locations)
GRANT EXECUTE ON FUNCTION get_latest_telegram_locations(integer, double precision) TO public;
