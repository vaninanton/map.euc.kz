-- Возможность разово отменить отдельную дату события: дата остаётся видимой
-- в ленте, но помечена «Отменено» и не считается ближайшим вхождением.

ALTER TABLE map_event_dates
    ADD COLUMN cancelled boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN map_event_dates.cancelled IS 'Дата разово отменена (показывается, но не считается вхождением)';
