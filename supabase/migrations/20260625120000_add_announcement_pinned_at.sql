-- Состояние закрепления сообщения анонса в Telegram-чате.
-- pinned_at != null — сообщение закреплено (pinChatMessage); null — откреплено/не закреплялось.
-- Хранится в БД, т.к. Telegram не даёт дёшево спросить «закреплён ли конкретный message_id».

ALTER TABLE map_event_announcements
    ADD COLUMN pinned_at timestamp with time zone;

COMMENT ON COLUMN map_event_announcements.pinned_at IS 'Время закрепления сообщения в чате (NULL — не закреплено)';
