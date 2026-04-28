CREATE TYPE point_types AS ENUM (
    'point',
    'socket'
);
COMMENT ON TYPE point_types IS 'Типы точек на карте';

CREATE TABLE map_points (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    coordinates double precision[] NOT NULL,
    type point_types DEFAULT 'point'::point_types NOT NULL,
    flag_is_meeting boolean DEFAULT false NOT NULL,
    flag_has_socket boolean DEFAULT false NOT NULL,
    flag_disabled boolean DEFAULT false NOT NULL,
    description text,
    CONSTRAINT map_points_title_check CHECK (((length(title) > 3) AND (length(title) < 100)))
);
COMMENT ON TABLE map_points IS 'Точки на карте';
COMMENT ON COLUMN map_points.created_at IS 'Дата создания точки';
COMMENT ON COLUMN map_points.title IS 'Имя точки';
COMMENT ON COLUMN map_points.coordinates IS 'Координаты точки';
COMMENT ON COLUMN map_points.description IS 'Краткое описание точки';
COMMENT ON COLUMN map_points.flag_is_meeting IS 'Место встречи';
COMMENT ON COLUMN map_points.flag_has_socket IS 'Есть розетка';
COMMENT ON COLUMN map_points.flag_disabled IS 'Не показывать на сайте';

CREATE POLICY "Enable read access for all users" ON map_points FOR SELECT TO anon USING ((flag_disabled = false));

ALTER TABLE map_points ENABLE ROW LEVEL SECURITY;
