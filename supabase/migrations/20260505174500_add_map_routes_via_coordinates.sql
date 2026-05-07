ALTER TABLE map_routes
    ADD COLUMN via_coordinates jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE map_routes
    ADD CONSTRAINT map_routes_via_coordinates_check
    CHECK (jsonb_typeof(via_coordinates) = 'array'::text);
COMMENT ON COLUMN map_routes.via_coordinates IS 'Промежуточные точки маршрута для внешней навигации';
