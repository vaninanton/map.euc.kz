-- Функционал «Новости проекта»: свободный текст (+ опциональное фото), рассылаемый
-- в выбранные telegram_chats, с правкой и удалением отправленного.
--
-- Архитектурно объединяем исходящие сообщения бота в одну таблицу
-- telegram_outbound_messages (переименование существующей map_event_announcements),
-- с полиморфной привязкой: event_date_id ЛИБО news_id. Так анонсы событий и новости
-- живут в общей таблице — единый маппинг (chat_id, message_id) → отправитель,
-- общий send/edit/delete. RSVP/cancel/pin остаются специфичны для событий.

-- ───────────────────────── map_news ─────────────────────────
-- Новость = черновик в БД: тело (свободный текст) + опциональное фото.
-- Живёт только в Telegram (публичного чтения с карты нет); deleted_at — мягкое удаление.
CREATE TABLE map_news (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    photo_path text,
    deleted_at timestamp with time zone
);
COMMENT ON TABLE map_news IS 'Новости проекта для рассылки в Telegram-чаты (черновик + история отправок)';
COMMENT ON COLUMN map_news.body IS 'Свободный текст новости (без HTML-эскейпа) — источник истины для отправки и правки';
COMMENT ON COLUMN map_news.photo_path IS 'Путь к изображению новости в Storage (NULL — без картинки)';
COMMENT ON COLUMN map_news.deleted_at IS 'Время мягкого удаления новости из админки (строка остаётся для истории)';

CREATE INDEX map_news_created_at_idx ON map_news (created_at DESC);

ALTER TABLE map_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Администраторы читают новости"
    ON map_news
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));
CREATE POLICY "Администраторы создают новости"
    ON map_news
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));
CREATE POLICY "Администраторы обновляют новости"
    ON map_news
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));
CREATE POLICY "Администраторы удаляют новости"
    ON map_news
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM map_admin_users m WHERE m.user_id = auth.uid()));

-- ───────────── map_event_announcements → telegram_outbound_messages ─────────────
-- Переименование сохраняет данные, RLS-политику и FK event_date_id. Затем обобщаем:
-- event_date_id становится nullable, добавляем news_id; ровно один из них должен быть задан.
ALTER TABLE map_event_announcements RENAME TO telegram_outbound_messages;

-- Имена индексов и constraint'ов при RENAME TABLE не меняются — приводим к новому неймингу.
ALTER TABLE telegram_outbound_messages
    RENAME CONSTRAINT map_event_announcements_chat_msg_key TO telegram_outbound_messages_chat_msg_key;
ALTER INDEX map_event_announcements_event_date_id_idx RENAME TO telegram_outbound_messages_event_date_id_idx;
ALTER INDEX map_event_announcements_msg_lookup_idx RENAME TO telegram_outbound_messages_msg_lookup_idx;

-- event_date_id больше не обязателен (у новостей он NULL).
ALTER TABLE telegram_outbound_messages ALTER COLUMN event_date_id DROP NOT NULL;

-- Привязка к новости (полиморфно с event_date_id).
ALTER TABLE telegram_outbound_messages
    ADD COLUMN news_id uuid REFERENCES map_news(id) ON DELETE CASCADE;

-- Ровно один родитель: либо событие, либо новость.
ALTER TABLE telegram_outbound_messages
    ADD CONSTRAINT telegram_outbound_messages_one_parent CHECK (
        (event_date_id IS NOT NULL AND news_id IS NULL)
        OR (event_date_id IS NULL AND news_id IS NOT NULL)
    );

CREATE INDEX telegram_outbound_messages_news_id_idx ON telegram_outbound_messages (news_id);

COMMENT ON TABLE telegram_outbound_messages IS 'Исходящие сообщения бота: анонсы событий (event_date_id) и новости проекта (news_id) — единый маппинг (chat_id, message_id) → отправитель';
COMMENT ON COLUMN telegram_outbound_messages.event_date_id IS 'Дата события, к которой относится анонс (NULL для новостей)';
COMMENT ON COLUMN telegram_outbound_messages.news_id IS 'Новость, к которой относится сообщение (NULL для анонсов событий)';

-- ───────────────────────── Storage: map-news-photos ─────────────────────────
-- Публичное чтение (Telegram тянет фото по публичному URL), запись — только администраторы.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'map-news-photos',
    'map-news-photos',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read access for map news photos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'map-news-photos');

CREATE POLICY "Администраторы загружают фото новостей"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'map-news-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    );
CREATE POLICY "Администраторы обновляют фото новостей в storage"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'map-news-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    )
    WITH CHECK (
        bucket_id = 'map-news-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    );
CREATE POLICY "Администраторы удаляют фото новостей в storage"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'map-news-photos'
        AND EXISTS (SELECT 1 FROM public.map_admin_users m WHERE m.user_id = auth.uid())
    );
