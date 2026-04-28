CREATE TABLE map_points_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    type text NOT NULL,
    title text NOT NULL,
    coordinates jsonb NOT NULL,
    flag_is_meeting boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL
    CONSTRAINT map_points_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT map_points_submissions_title_check CHECK ((char_length(TRIM(BOTH FROM title)) > 0)),
    CONSTRAINT map_points_submissions_type_check CHECK ((type = ANY (ARRAY['point'::text, 'socket'::text])))
);

COMMENT ON TABLE map_points_submissions IS 'Пользовательские заявки на добавление точек и розеток.';
COMMENT ON COLUMN map_points_submissions.coordinates IS 'Координаты [lon, lat] в формате JSON массива.';

CREATE POLICY insert_map_points_submissions ON map_points_submissions FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE map_points_submissions ENABLE ROW LEVEL SECURITY;
