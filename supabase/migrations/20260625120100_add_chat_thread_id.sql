-- Поддержка форумных групп (топиков/вкладок): сообщение можно адресовать в конкретную тему.
-- message_thread_id != null — слать анонс в эту тему; null — обычный чат / General.
-- Хранится у чата, т.к. тема фиксирована для рассылки. Правка/удаление/закрепление
-- работают по chat_id+message_id и тему не требуют (message_id уникален в пределах чата).

ALTER TABLE telegram_chats
    ADD COLUMN message_thread_id bigint;

COMMENT ON COLUMN telegram_chats.message_thread_id IS 'ID темы форумной группы для отправки анонса (NULL — обычный чат/General)';
