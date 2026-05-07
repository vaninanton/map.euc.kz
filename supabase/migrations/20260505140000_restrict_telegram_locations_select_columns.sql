-- Анонимные и authenticated-клиенты не должны читать raw_update (полный Telegram payload).
-- Service role и Edge Function по-прежнему имеют полный доступ к таблице.
REVOKE SELECT ON telegram_locations FROM anon;
REVOKE SELECT ON telegram_locations FROM authenticated;
GRANT SELECT (
    id,
    created_at,
    telegram_update_id,
    chat_id,
    chat_type,
    chat_title,
    message_id,
    telegram_user_id,
    username,
    first_name,
    last_name,
    longitude,
    latitude,
    location_accuracy_meters,
    location_live_period_seconds,
    location_heading,
    location_proximity_alert_radius
) ON telegram_locations TO anon, authenticated;
