-- Несколько тем одного форума как отдельные «назначения» рассылки.
-- Раньше chat_id был первичным ключом → один чат = одна строка = одна тема.
-- Теперь строка = (чат + тема); добавляем суррогатный id, а уникальность переносим
-- на пару (chat_id, message_thread_id). NULLS NOT DISTINCT — чтобы нельзя было завести
-- два «обычных» чата (thread = NULL) с одним chat_id.

-- 1. Суррогатный первичный ключ.
ALTER TABLE telegram_chats ADD COLUMN id uuid DEFAULT gen_random_uuid();
UPDATE telegram_chats SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE telegram_chats ALTER COLUMN id SET NOT NULL;

ALTER TABLE telegram_chats DROP CONSTRAINT telegram_chats_pkey;
ALTER TABLE telegram_chats ADD CONSTRAINT telegram_chats_pkey PRIMARY KEY (id);

-- 2. Уникальность назначения: один (чат, тема) — одна строка.
ALTER TABLE telegram_chats
    ADD CONSTRAINT telegram_chats_chat_thread_key UNIQUE NULLS NOT DISTINCT (chat_id, message_thread_id);

COMMENT ON COLUMN telegram_chats.id IS 'Суррогатный ключ назначения рассылки (чат + тема)';
COMMENT ON COLUMN telegram_chats.chat_id IS 'ID чата Telegram (может повторяться для разных тем форума)';
