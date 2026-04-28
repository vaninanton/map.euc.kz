INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'map-point-photos',
    'map-point-photos',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read access for map point photos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'map-point-photos');

CREATE POLICY "Public upload access for map point photos"
    ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'map-point-photos');
