CREATE TABLE telegram_locations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    telegram_update_id bigint NOT NULL UNIQUE,
    chat_id bigint NOT NULL,
    chat_type text,
    chat_title text,
    message_id bigint NOT NULL,
    telegram_user_id bigint NOT NULL,
    username text,
    first_name text,
    last_name text,
    longitude double precision NOT NULL,
    latitude double precision NOT NULL,
    location_accuracy_meters double precision,
    location_live_period_seconds integer,
    location_heading integer,
    location_proximity_alert_radius integer,
    raw_update jsonb NOT NULL,
    CONSTRAINT telegram_locations_longitude_check CHECK (longitude BETWEEN -180::double precision AND 180::double precision),
    CONSTRAINT telegram_locations_latitude_check CHECK (latitude BETWEEN -90::double precision AND 90::double precision)
);

COMMENT ON TABLE telegram_locations IS 'Локации, отправленные пользователями в Telegram-чат.';
COMMENT ON COLUMN telegram_locations.telegram_update_id IS 'Уникальный идентификатор update из Telegram.';
COMMENT ON COLUMN telegram_locations.chat_id IS 'Идентификатор чата, где прислали геолокацию.';
COMMENT ON COLUMN telegram_locations.telegram_user_id IS 'Идентификатор пользователя Telegram.';
COMMENT ON COLUMN telegram_locations.raw_update IS 'Оригинальный payload update от Telegram.';

ALTER TABLE telegram_locations ENABLE ROW LEVEL SECURITY;

CREATE INDEX telegram_locations_chat_id_created_at_idx ON telegram_locations (chat_id, created_at DESC);
CREATE INDEX telegram_locations_user_id_created_at_idx ON telegram_locations (telegram_user_id, created_at DESC);
