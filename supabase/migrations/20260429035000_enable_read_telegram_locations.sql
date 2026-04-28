CREATE POLICY "Enable read access for telegram route"
    ON telegram_locations
    FOR SELECT
    TO anon
    USING (true);
