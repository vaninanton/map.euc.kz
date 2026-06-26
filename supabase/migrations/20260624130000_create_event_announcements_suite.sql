-- Сводная миграция функционала анонсов событий в Telegram (свёртка прежних 120000–120400).
-- Создаёт три таблицы: telegram_chats, map_event_announcements, map_event_participants —
-- сразу с финальным набором колонок (вкл. deleted_at, body_text, photo_path).

-- ───────────────────────── telegram_chats ─────────────────────────
-- Чаты для рассылки анонсов. CRUD в админке; Edge Function читает enabled-чаты.
CREATE TABLE telegram_chats (
    chat_id bigint PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
COMMENT ON TABLE telegram_chats IS 'Telegram-чаты для рассылки анонсов событий (выбираются чекбоксами в админке)';
COMMENT ON COLUMN telegram_chats.chat_id IS 'ID чата Telegram (личка или группа, отрицательный для групп)';
COMMENT ON COLUMN telegram_chats.title IS 'Читаемое имя чата для админки';
COMMENT ON COLUMN telegram_chats.enabled IS 'Доступен ли чат для рассылки';
COMMENT ON COLUMN telegram_chats.sort_order IS 'Порядок в списке';

CREATE INDEX telegram_chats_sort_order_idx ON telegram_chats (sort_order);

ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Администраторы читают чаты"
    ON telegram_chats
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));
CREATE POLICY "Администраторы создают чаты"
    ON telegram_chats
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));
CREATE POLICY "Администраторы обновляют чаты"
    ON telegram_chats
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));
CREATE POLICY "Администраторы удаляют чаты"
    ON telegram_chats
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));

INSERT INTO telegram_chats (chat_id, title, enabled, sort_order)
VALUES (131396, 'Личка (Tony V)', true, 0)
ON CONFLICT (chat_id) DO NOTHING;

-- ───────────────────────── map_event_announcements ─────────────────────────
-- Одна строка = одно отправленное в чат сообщение анонса. По (chat_id, message_id)
-- из callback_query находим дату для счётчика; используется для отмены/правки/удаления.
CREATE TABLE map_event_announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_date_id uuid NOT NULL REFERENCES map_event_dates(id) ON DELETE CASCADE,
    telegram_chat_id bigint NOT NULL,
    telegram_message_id bigint,
    message_text text NOT NULL,
    body_text text,
    photo_path text,
    sent_at timestamp with time zone,
    send_error text,
    cancelled_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT map_event_announcements_chat_msg_key UNIQUE (telegram_chat_id, telegram_message_id)
);
COMMENT ON TABLE map_event_announcements IS 'Отправленные в Telegram анонсы дат событий (маппинг message → дата, счётчик, отмена/правка/удаление)';
COMMENT ON COLUMN map_event_announcements.event_date_id IS 'Дата события, к которой относится анонс';
COMMENT ON COLUMN map_event_announcements.telegram_chat_id IS 'Чат, куда отправлен анонс';
COMMENT ON COLUMN map_event_announcements.telegram_message_id IS 'ID сообщения в Telegram (NULL до подтверждения отправки)';
COMMENT ON COLUMN map_event_announcements.message_text IS 'Снимок итогового текста (со шапкой) на момент отправки';
COMMENT ON COLUMN map_event_announcements.body_text IS 'Сырое тело анонса (без шапки и HTML-эскейпа) — источник истины для правки';
COMMENT ON COLUMN map_event_announcements.photo_path IS 'Путь к изображению анонса в Storage (NULL — без картинки)';
COMMENT ON COLUMN map_event_announcements.sent_at IS 'Время успешной отправки (NULL если не удалось)';
COMMENT ON COLUMN map_event_announcements.send_error IS 'Описание ошибки Telegram API, если отправка не удалась';
COMMENT ON COLUMN map_event_announcements.cancelled_at IS 'Время авто-отмены анонса (сообщение помечено «ОТМЕНЕНО»)';
COMMENT ON COLUMN map_event_announcements.deleted_at IS 'Время удаления сообщения из Telegram админом (строка остаётся для истории)';

CREATE INDEX map_event_announcements_event_date_id_idx ON map_event_announcements (event_date_id);
CREATE INDEX map_event_announcements_msg_lookup_idx ON map_event_announcements (telegram_chat_id, telegram_message_id);

ALTER TABLE map_event_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Администраторы читают анонсы"
    ON map_event_announcements
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));

-- ───────────────────────── map_event_participants ─────────────────────────
-- RSVP «Участвую» по датам: одна строка = один участник на дату (toggle).
CREATE TABLE map_event_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_date_id uuid NOT NULL REFERENCES map_event_dates(id) ON DELETE CASCADE,
    telegram_user_id bigint NOT NULL REFERENCES telegram_profiles(telegram_user_id) ON DELETE CASCADE,
    CONSTRAINT map_event_participants_date_user_key UNIQUE (event_date_id, telegram_user_id)
);
COMMENT ON TABLE map_event_participants IS 'RSVP «Участвую» по датам событий: одна строка = один участник на дату';
COMMENT ON COLUMN map_event_participants.event_date_id IS 'Дата события, на которую записался участник';
COMMENT ON COLUMN map_event_participants.telegram_user_id IS 'Telegram-пользователь (FK telegram_profiles)';

CREATE INDEX map_event_participants_event_date_id_idx ON map_event_participants (event_date_id);
CREATE INDEX map_event_participants_telegram_user_id_idx ON map_event_participants (telegram_user_id);

ALTER TABLE map_event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Администраторы читают участников"
    ON map_event_participants
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));
