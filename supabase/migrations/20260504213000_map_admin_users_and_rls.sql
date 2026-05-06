-- Администраторы карты: только Supabase Auth + publishable key в браузере.
-- Строки добавляются вручную в SQL Editor (INSERT по uuid из auth.users).

CREATE TABLE map_admin_users (
    user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE map_admin_users IS 'Администраторы карты (Supabase Auth). Назначение — только через SQL / Dashboard.';
ALTER TABLE map_admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Пользователь видит только свою запись администратора"
    ON map_admin_users
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
-- map_points: полный доступ для администраторов (отдельно от анонимного чтения опубликованных)
CREATE POLICY "Администраторы читают все точки"
    ON map_points
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы создают точки"
    ON map_points
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы обновляют точки"
    ON map_points
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы удаляют точки"
    ON map_points
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
-- map_routes
CREATE POLICY "Администраторы читают все маршруты"
    ON map_routes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы создают маршруты"
    ON map_routes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы обновляют маршруты"
    ON map_routes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы удаляют маршруты"
    ON map_routes
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
-- map_points_submissions
CREATE POLICY "Администраторы читают заявки"
    ON map_points_submissions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы обновляют заявки"
    ON map_points_submissions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
-- map_point_photos
CREATE POLICY "Администраторы читают все фото точек"
    ON map_point_photos
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы добавляют фото точек"
    ON map_point_photos
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы обновляют фото точек"
    ON map_point_photos
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы удаляют фото точек"
    ON map_point_photos
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
-- Storage: убираем публичную загрузку, оставляем только администраторам
DROP POLICY IF EXISTS "Public upload access for map point photos" ON storage.objects;
CREATE POLICY "Администраторы читают объекты фото точек"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'map-point-photos'
        AND EXISTS (
            SELECT 1
            FROM public.map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы загружают фото точек"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'map-point-photos'
        AND EXISTS (
            SELECT 1
            FROM public.map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы обновляют фото точек в storage"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'map-point-photos'
        AND EXISTS (
            SELECT 1
            FROM public.map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        bucket_id = 'map-point-photos'
        AND EXISTS (
            SELECT 1
            FROM public.map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
CREATE POLICY "Администраторы удаляют фото точек в storage"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'map-point-photos'
        AND EXISTS (
            SELECT 1
            FROM public.map_admin_users m
            WHERE m.user_id = auth.uid()
        )
    );
