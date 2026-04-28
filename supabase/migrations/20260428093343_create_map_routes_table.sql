CREATE TABLE map_routes (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    coordinates jsonb NOT NULL,
    flag_disabled boolean DEFAULT false NOT NULL,
    description text
);

COMMENT ON TABLE map_routes IS 'Маршруты на карте';
COMMENT ON COLUMN map_routes.id IS 'Идентификатор';
COMMENT ON COLUMN map_routes.created_at IS 'Дата создания';
COMMENT ON COLUMN map_routes.flag_disabled IS 'Не показывать на сайте';
COMMENT ON COLUMN map_routes.title IS 'Название маршрута';
COMMENT ON COLUMN map_routes.description IS 'Краткое описание маршрута';
COMMENT ON COLUMN map_routes.coordinates IS 'Массив с координатами маршрута';

CREATE POLICY "Enable read access for all users" ON map_routes FOR SELECT TO anon USING ((flag_disabled = false));

ALTER TABLE map_routes ENABLE ROW LEVEL SECURITY;
