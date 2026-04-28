CREATE TABLE map_point_photos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    point_id bigint NOT NULL REFERENCES map_points(id) ON DELETE CASCADE,
    bucket_name text NOT NULL DEFAULT 'map-point-photos'::text,
    storage_path text NOT NULL,
    alt_text text,
    sort_order smallint NOT NULL DEFAULT 0,
    CONSTRAINT map_point_photos_storage_path_check CHECK (char_length(trim(BOTH FROM storage_path)) > 0),
    CONSTRAINT map_point_photos_sort_order_check CHECK (sort_order >= 0),
    CONSTRAINT map_point_photos_point_id_storage_path_key UNIQUE (point_id, storage_path)
);

COMMENT ON TABLE map_point_photos IS 'Фотографии точек из Supabase Storage';
COMMENT ON COLUMN map_point_photos.point_id IS 'Идентификатор точки на карте';
COMMENT ON COLUMN map_point_photos.bucket_name IS 'Название bucket в Supabase Storage';
COMMENT ON COLUMN map_point_photos.storage_path IS 'Путь к файлу внутри bucket';
COMMENT ON COLUMN map_point_photos.alt_text IS 'Описание фотографии';
COMMENT ON COLUMN map_point_photos.sort_order IS 'Порядок отображения фотографии в карточке точки';

CREATE POLICY "Enable read access for all users" ON map_point_photos
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1
            FROM map_points
            WHERE map_points.id = map_point_photos.point_id
                AND map_points.flag_disabled = false
        )
    );

ALTER TABLE map_point_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX map_point_photos_point_id_sort_order_idx ON map_point_photos (point_id, sort_order, created_at);
