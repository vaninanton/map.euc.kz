CREATE TABLE telegram_profiles (
    telegram_user_id bigint PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    first_name text,
    last_name text,
    avatar_url text
);

COMMENT ON TABLE telegram_profiles IS 'Профили пользователей Telegram для отображения на карте.';
COMMENT ON COLUMN telegram_profiles.telegram_user_id IS 'Идентификатор пользователя Telegram.';
COMMENT ON COLUMN telegram_profiles.avatar_url IS 'URL аватара пользователя Telegram.';

ALTER TABLE telegram_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for telegram profiles"
    ON telegram_profiles
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Enable service role manage telegram profiles"
    ON telegram_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE OR REPLACE FUNCTION set_telegram_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_telegram_profiles_updated_at_trigger
BEFORE UPDATE ON telegram_profiles
FOR EACH ROW
EXECUTE FUNCTION set_telegram_profiles_updated_at();
