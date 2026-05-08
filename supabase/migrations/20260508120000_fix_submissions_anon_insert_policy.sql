-- Restore anonymous INSERT policy for map_points_submissions.
-- Policy was defined in the original table migration but may be missing in production.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'map_points_submissions'
          AND policyname = 'insert_map_points_submissions'
    ) THEN
        CREATE POLICY insert_map_points_submissions
            ON map_points_submissions
            FOR INSERT TO anon
            WITH CHECK (true);
    END IF;
END $$;
