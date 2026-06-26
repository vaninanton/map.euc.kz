-- Тема форумной группы, в которую отправлен анонс. Нужна, чтобы в режиме правки
-- точно определять «куда ещё не отправлено»: назначение рассылки — это пара
-- (chat_id, message_thread_id), а раньше в анонсе хранился только chat_id, из-за чего
-- разные темы одного форума были неразличимы. NULL — обычный чат / General.

ALTER TABLE map_event_announcements
    ADD COLUMN message_thread_id bigint;

COMMENT ON COLUMN map_event_announcements.message_thread_id IS 'ID темы форумной группы, куда отправлен анонс (NULL — обычный чат/General)';
