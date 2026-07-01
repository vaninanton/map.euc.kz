# База данных (Supabase / PostgreSQL 17)

Схема управляется **только** миграциями в `supabase/migrations/` (26 файлов). `supabase/schema.sql` — справочный экспорт, руками не редактируется.

## Правила работы с миграциями

- Новая миграция: `supabase migration new <name>` → SQL-файл → локально `supabase db reset` → на прод через `supabase db push` или CI (deploy.yml).
- **Запрещено** применять миграции через MCP `apply_migration`/`execute_sql`: MCP пишет в `schema_migrations` автогенерённый таймстамп, расходящийся с именем файла, и ломает деплой. Разошедшуюся историю чинить `supabase migration repair`, сверять `supabase migration list`.
- Каждая новая таблица обязана сразу получить RLS-политики (`ENABLE ROW LEVEL SECURITY` + политики) — таблица без политик недоступна либо, что хуже, открыта.

## Enums

```sql
point_types:        'point' | 'socket'
submission_status:  'pending' | 'approved' | 'rejected'
event_types:        'group_ride' | 'event' | 'training'
```

## Таблицы

### Карта

**`map_points`** — точки и розетки.
`id bigint PK` · `created_at` · `title text` (CHECK 4–99 симв.) · `coordinates double precision[]` ([lon, lat], CHECK диапазонов) · `type point_types` · `description` · флаги `flag_is_meeting`, `flag_has_socket`, `flag_erlan`, `flag_disabled` (все boolean NOT NULL DEFAULT false). Индексы по `flag_disabled`, `flag_erlan`.

**`map_routes`** — маршруты.
`id bigint PK` · `title` (CHECK 4–99) · `coordinates jsonb` (массив [lon, lat] или [lon, lat, elevation], минимум 2 точки) · `via_coordinates jsonb` (промежуточные точки для внешних навигаторов) · `description` · `flag_disabled` · `flag_erlan`.

**`map_points_submissions`** — очередь модерации пользовательских заявок.
`id uuid PK` · `created_at` · `processed_at` · `type point_types` · `title` · `description` · `coordinates jsonb` · `flag_is_meeting` · `status submission_status DEFAULT 'pending'`. Индекс `(status, created_at)`.

**`map_point_photos`** — фото точек.
`id uuid PK` · `point_id bigint FK → map_points ON DELETE CASCADE` · `bucket_name DEFAULT 'map-point-photos'` · `storage_path` (UNIQUE с point_id) · `alt_text` · `sort_order smallint ≥ 0`.

### События и новости

**`map_events`** — события (покатушки/мероприятия/обучение).
`id bigint PK` · `created_at` · `updated_at` (триггер) · `type event_types DEFAULT 'group_ride'` · `title` (CHECK 4–99) · `description` · `photo_bucket DEFAULT 'map-event-photos'` · `photo_path` · `duration_minutes smallint > 0` · `location_text` · `start_coordinates` / `finish_coordinates double precision[]` (nullable) · `start_point_id` / `finish_point_id bigint FK → map_points ON DELETE SET NULL` · `flag_disabled`.
Старт/финиш: либо привязанная точка (приоритет), либо ручные координаты.

**`map_event_dates`** — даты проведения.
`id uuid PK` · `event_id bigint FK → map_events ON DELETE CASCADE` · `starts_at timestamptz` · `note` · `cancelled boolean DEFAULT false`. UNIQUE `(event_id, starts_at)`.

**`map_event_participants`** — RSVP «Участвую» (toggle из Telegram).
`id uuid PK` · `event_date_id uuid FK → map_event_dates CASCADE` · `telegram_user_id bigint FK → telegram_profiles CASCADE`. UNIQUE `(event_date_id, telegram_user_id)`.

**`map_news`** — новости проекта (только для рассылки, публичной страницы нет).
`id uuid PK` · `created_at` · `body text` (источник истины для правки сообщений) · `photo_path` · `deleted_at` (мягкое удаление — строка остаётся для истории).

### Telegram

**`telegram_locations`** — live-геопозиции (пишет только edge-функция).
`id uuid PK` · `created_at` · `telegram_update_id bigint UNIQUE` · `chat_id` / `chat_type` / `chat_title` · `message_id` · `telegram_user_id` · снапшоты `username`/`first_name`/`last_name` · `longitude`/`latitude` (CHECK диапазонов) · `location_accuracy_meters` · `location_live_period_seconds` · `location_heading` · `location_proximity_alert_radius` · `raw_update jsonb` (скрыт от anon). Индексы `(chat_id, created_at)`, `(telegram_user_id, created_at)`, `(created_at, id)`.
Сохраняются только live-геопозиции (`live_period > 0`); одиночные точки-«поделиться местом» пропускаются.

**`telegram_profiles`** — кэш профилей.
`telegram_user_id bigint PK` · `username` · `first_name` · `last_name` · `avatar_url` (только безопасный Storage-URL, без bot-токена) · `updated_at` (триггер).

**`telegram_chats`** — назначения рассылки анонсов (управляется в `/admin/telegram-chats`).
`id uuid PK` (суррогатный) · `chat_id bigint` · `message_thread_id bigint` (тема форумной группы; NULL = обычный чат/General) · `title` · `enabled` · `sort_order`. UNIQUE `(chat_id, message_thread_id) NULLS NOT DISTINCT`.

**`telegram_outbound_messages`** — единая таблица исходящих сообщений бота (бывшая `map_event_announcements`, переименована в `20260627120000`). Полиморфная привязка: `event_date_id uuid FK` (анонс даты события) **ЛИБО** `news_id uuid FK` (новость) — CHECK гарантирует ровно один.
`telegram_chat_id` · `message_thread_id` · `telegram_message_id` (NULL до успешной отправки) · `message_text` (итоговый текст с шапкой) · `body_text` (сырое тело — источник для правки) · `photo_path` · `sent_at` · `send_error` · `cancelled_at` (текст заменён на «❌ ОТМЕНЕНО») · `deleted_at` (удалено из Telegram) · `pinned_at`. UNIQUE `(telegram_chat_id, telegram_message_id)`.
«Живое» сообщение: `telegram_message_id IS NOT NULL AND send_error IS NULL AND cancelled_at IS NULL AND deleted_at IS NULL`.

### Доступ

**`map_admin_users`** — администраторы.
`user_id uuid PK FK → auth.users ON DELETE CASCADE`. Заполняется вручную (INSERT в SQL Editor). Является шлюзом для всех admin-политик RLS.

## RPC

**`get_admin_dashboard_stats()`** — агрегаты для админ-дашборда одним вызовом: счётчики контента (точки/маршруты/события/фото/новости), pending-заявки, включённые чаты, ошибки рассылок за 30 дней, время последней геопозиции, уникальные райдеры за сегодня/7 дней/30 дней/год и активность по дням за 30 дней (границы периодов — полуночь Asia/Almaty). SECURITY DEFINER; внутри проверка `map_admin_users`, иначе `42501`. EXECUTE только `authenticated`.

**`get_latest_telegram_locations(ttl_minutes int DEFAULT 60, max_accuracy_meters int DEFAULT 100)`** — последняя позиция каждого пользователя за TTL, JOIN с `telegram_profiles` (имя, аватар), фильтр по точности. Возвращает по одной строке на райдера (ROW_NUMBER, самая свежая). GRANT EXECUTE TO public — раздаёт только безопасные колонки (без `raw_update`).

## Матрица RLS (упрощённо)

| Таблица                                             | anon чтение                              | anon запись | admin (authenticated + map_admin_users) | service role |
| --------------------------------------------------- | ---------------------------------------- | ----------- | --------------------------------------- | ------------ |
| `map_points` / `map_routes` / `map_events` (+dates) | только `flag_disabled = false`           | ✗           | полный CRUD                             | ✓            |
| `map_point_photos`                                  | только фото видимых точек                | ✗           | CRUD                                    | ✓            |
| `map_points_submissions`                            | ✗                                        | INSERT      | чтение + UPDATE                         | ✓            |
| `map_event_participants`                            | ✗                                        | ✗           | только чтение                           | ✓ (бот)      |
| `telegram_profiles`                                 | ✓                                        | ✗           | ✗                                       | ✓ (бот)      |
| `telegram_locations`                                | ✓ (безопасные колонки, без `raw_update`) | ✗           | ✗                                       | ✓ (бот)      |
| `telegram_chats`                                    | ✗                                        | ✗           | CRUD                                    | ✓            |
| `telegram_outbound_messages`                        | ✗                                        | ✗           | только чтение                           | ✓ (бот)      |
| `map_news`                                          | ✗                                        | ✗           | CRUD                                    | ✓            |
| `map_admin_users`                                   | ✗                                        | ✗           | только своя строка                      | ✓            |

## Storage-бакеты

| Бакет              | Публичное чтение           | Запись       | Содержимое                                 |
| ------------------ | -------------------------- | ------------ | ------------------------------------------ |
| `map-point-photos` | через public URL           | админы       | фото точек, путь `{point_id}/{uuid}.{ext}` |
| `map-event-photos` | через public URL           | админы       | фото событий                               |
| `map-news-photos`  | да (10 MiB, jpeg/png/webp) | админы       | фото новостей                              |
| `telegram-avatars` | да                         | edge-функция | кэш аватаров Telegram (без bot-токена)     |

Все URL строятся через `supabase.storage.from(bucket).getPublicUrl(path)` — bot-токены в URL не допускаются.

## Локальная разработка

```bash
supabase start      # полный стек в Docker: API 54321, DB 54322, Studio 54323
supabase db reset   # пересоздать локальную БД по миграциям
supabase functions serve telegram-location-bot   # edge-функция с hot-reload
```

Подробнее — в [../README.md](../README.md) («Локальная разработка бэкенда»).
