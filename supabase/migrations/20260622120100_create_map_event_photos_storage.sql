-- Storage-бакет для фотографий событий. Публичное чтение, загрузка/изменение —
-- только администраторы (как у map-point-photos после ужесточения политик).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'map-event-photos',
    'map-event-photos',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read access for map event photos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'map-event-photos');

CREATE POLICY "Администраторы загружают фото событий"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'map-event-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    );
CREATE POLICY "Администраторы обновляют фото событий в storage"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'map-event-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    )
    WITH CHECK (
        bucket_id = 'map-event-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    );
CREATE POLICY "Администраторы удаляют фото событий в storage"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'map-event-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    );
