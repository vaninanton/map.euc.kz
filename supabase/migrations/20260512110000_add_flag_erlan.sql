ALTER TABLE map_points ADD COLUMN flag_erlan boolean DEFAULT false NOT NULL;
ALTER TABLE map_routes ADD COLUMN flag_erlan boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN map_points.flag_erlan IS 'Ерландия — проезжает только Ерлан';
COMMENT ON COLUMN map_routes.flag_erlan IS 'Ерландия — проезжает только Ерлан';

CREATE INDEX map_points_flag_erlan_idx ON map_points (flag_erlan);
CREATE INDEX map_routes_flag_erlan_idx ON map_routes (flag_erlan);
