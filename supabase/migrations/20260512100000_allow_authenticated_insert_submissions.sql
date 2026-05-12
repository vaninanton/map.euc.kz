-- Authenticated users (admins) can also submit points via the user-facing form.
CREATE POLICY "Аутентифицированные пользователи создают заявки"
    ON map_points_submissions
    FOR INSERT TO authenticated
    WITH CHECK (true);
