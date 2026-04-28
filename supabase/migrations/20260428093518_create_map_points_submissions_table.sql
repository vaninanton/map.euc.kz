CREATE TYPE submission_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);
COMMENT ON TYPE submission_status IS 'Статус модерации пользовательской заявки';

CREATE TABLE map_points_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    type point_types NOT NULL,
    title text NOT NULL,
    coordinates jsonb NOT NULL,
    flag_is_meeting boolean DEFAULT false NOT NULL,
    status submission_status DEFAULT 'pending'::submission_status NOT NULL,
    CONSTRAINT map_points_submissions_title_check CHECK ((char_length(TRIM(BOTH FROM title)) > 0)),
    CONSTRAINT map_points_submissions_coordinates_check CHECK (
        (jsonb_typeof(coordinates) = 'array'::text)
        AND (jsonb_array_length(coordinates) = 2)
        AND ((coordinates ->> 0)::double precision BETWEEN -180::double precision AND 180::double precision)
        AND ((coordinates ->> 1)::double precision BETWEEN -90::double precision AND 90::double precision)
    )
);

COMMENT ON TABLE map_points_submissions IS 'Пользовательские заявки на добавление точек и розеток.';
COMMENT ON COLUMN map_points_submissions.coordinates IS 'Координаты [lon, lat] в формате JSON массива.';

CREATE POLICY insert_map_points_submissions ON map_points_submissions FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE map_points_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX map_points_submissions_status_created_at_idx ON map_points_submissions (status, created_at DESC);
