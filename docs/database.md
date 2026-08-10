# Database (Supabase / PostgreSQL 17)

The schema is managed **exclusively** by the migrations in `supabase/migrations/` (28 files). There is no exported `schema.sql` — this document plus the migrations are the reference.

## Migration rules

- New migration: `supabase migration new <name>` → write the SQL file → `supabase db reset` locally → to production via `supabase db push` or CI (deploy.yml).
- **Never** apply migrations through MCP `apply_migration`/`execute_sql`: MCP writes an auto-generated timestamp into `schema_migrations` that diverges from the file name and breaks deploys. Repair a diverged history with `supabase migration repair` and verify with `supabase migration list`.
- Every new table must get its RLS policies immediately (`ENABLE ROW LEVEL SECURITY` + policies) — a table without policies is either unreachable or, worse, wide open.
- Merging to `main` applies migrations to production straight away (deploy.yml).

## Enums

```sql
point_types:        'point' | 'socket'
submission_status:  'pending' | 'approved' | 'rejected'
event_types:        'group_ride' | 'event' | 'training'
```

## Tables

### Map

**`map_points`** — points and power sockets.
`id bigint PK` · `created_at` · `title text` (CHECK 4–99 chars) · `coordinates double precision[]` ([lon, lat], range CHECKs) · `type point_types` · `description` · flags `flag_is_meeting`, `flag_has_socket`, `flag_erlan`, `flag_disabled` (all boolean NOT NULL DEFAULT false). Indexed on `flag_disabled`, `flag_erlan`.

**`map_routes`** — routes.
`id bigint PK` · `title` (CHECK 4–99) · `coordinates jsonb` (an array of [lon, lat] or [lon, lat, elevation], at least 2 points) · `via_coordinates jsonb` (waypoints for external navigation apps) · `description` · `flag_disabled` · `flag_erlan`.

**`map_points_submissions`** — the moderation queue for user submissions.
`id uuid PK` · `created_at` · `processed_at` · `type point_types` · `title` · `description` · `coordinates jsonb` · `flag_is_meeting` · `status submission_status DEFAULT 'pending'`. Indexed on `(status, created_at)`.

**`map_point_photos`** — point photos.
`id uuid PK` · `point_id bigint FK → map_points ON DELETE CASCADE` · `bucket_name DEFAULT 'map-point-photos'` · `storage_path` (UNIQUE together with point_id) · `alt_text` · `sort_order smallint ≥ 0`.

### Events and news

**`map_events`** — events (group rides / meetups / training).
`id bigint PK` · `created_at` · `updated_at` (trigger) · `type event_types DEFAULT 'group_ride'` · `title` (CHECK 4–99) · `description` · `photo_bucket DEFAULT 'map-event-photos'` · `photo_path` · `duration_minutes smallint > 0` · `location_text` · `start_coordinates` / `finish_coordinates double precision[]` (nullable) · `start_point_id` / `finish_point_id bigint FK → map_points ON DELETE SET NULL` · `flag_disabled`.
Start/finish is either a linked point (takes priority) or manual coordinates.

**`map_event_dates`** — occurrence dates.
`id uuid PK` · `event_id bigint FK → map_events ON DELETE CASCADE` · `starts_at timestamptz` · `note` · `cancelled boolean DEFAULT false`. UNIQUE `(event_id, starts_at)`.

**`map_event_participants`** — «Участвую» RSVPs (toggled from Telegram).
`id uuid PK` · `event_date_id uuid FK → map_event_dates CASCADE` · `telegram_user_id bigint FK → telegram_profiles CASCADE`. UNIQUE `(event_date_id, telegram_user_id)`.

**`map_news`** — project news (broadcast only, there is no public page).
`id uuid PK` · `created_at` · `body text` (the source of truth when editing sent messages) · `photo_path` · `deleted_at` (soft delete — the row stays for history).

### Telegram

**`telegram_locations`** — live geolocations (written only by the edge function).
`id uuid PK` · `created_at` · `telegram_update_id bigint UNIQUE` · `chat_id` / `chat_type` / `chat_title` · `message_id` · `telegram_user_id` · snapshots of `username`/`first_name`/`last_name` · `longitude`/`latitude` (range CHECKs) · `location_accuracy_meters` · `location_live_period_seconds` · `location_heading` · `location_proximity_alert_radius` · `raw_update jsonb` (hidden from anon). Indexed on `(chat_id, created_at)`, `(telegram_user_id, created_at)`, `(created_at, id)`.
Only live geolocations are stored (`live_period > 0`); one-off "share my location" pins are skipped.

**`telegram_profiles`** — profile cache.
`telegram_user_id bigint PK` · `username` · `first_name` · `last_name` · `avatar_url` (a safe Storage URL only, never containing the bot token) · `updated_at` (trigger).

**`telegram_chats`** — announcement destinations (managed at `/admin/telegram-chats`).
`id uuid PK` (surrogate) · `chat_id bigint` · `message_thread_id bigint` (forum group topic; NULL = a plain chat / General) · `title` · `enabled` · `sort_order`. UNIQUE `(chat_id, message_thread_id) NULLS NOT DISTINCT`.

**`telegram_outbound_messages`** — the single table of outbound bot messages (formerly `map_event_announcements`, renamed in `20260627120000`). Polymorphic link: `event_date_id uuid FK` (an event date announcement) **OR** `news_id uuid FK` (a news item) — a CHECK guarantees exactly one.
`telegram_chat_id` · `message_thread_id` · `telegram_message_id` (NULL until sent successfully) · `message_text` (the final text including the header) · `body_text` (the raw body — the source for edits) · `photo_path` · `sent_at` · `send_error` · `cancelled_at` (text replaced with «❌ ОТМЕНЕНО») · `deleted_at` (removed from Telegram) · `pinned_at`. UNIQUE `(telegram_chat_id, telegram_message_id)`.
A "live" message is: `telegram_message_id IS NOT NULL AND send_error IS NULL AND cancelled_at IS NULL AND deleted_at IS NULL`.

### Access

**`map_admin_users`** — administrators.
`user_id uuid PK FK → auth.users ON DELETE CASCADE`. Populated manually (an INSERT in the SQL Editor). It is the gateway for every admin RLS policy.

## RPC

**`get_admin_dashboard_stats()`** — every admin dashboard aggregate in one call: content counters (points/routes/events/photos/news), pending submissions, enabled chats, broadcast errors over 30 days, the timestamp of the last geolocation, unique riders for today/7 days/30 days/year, and per-day activity over 30 days (period boundaries are midnight Asia/Almaty). The heavy `telegram_locations` aggregates read a 30-day window in a single scan (CTE `recent` → today/week/month + daily_activity); only the yearly rider count remains a separate wide scan. SECURITY DEFINER, with a `map_admin_users` check inside that otherwise raises `42501`. EXECUTE granted to `authenticated` only.

**`get_latest_telegram_locations(ttl_minutes int DEFAULT 60, max_accuracy_meters int DEFAULT 100)`** — each user's latest position within the TTL, joined with `telegram_profiles` (name, avatar), filtered by accuracy. Returns one row per rider (ROW_NUMBER, most recent). GRANT EXECUTE TO public — it exposes only the safe columns (no `raw_update`).

## RLS matrix (simplified)

| Table                                               | anon read                         | anon write | admin (authenticated + map_admin_users) | service role |
| --------------------------------------------------- | --------------------------------- | ---------- | --------------------------------------- | ------------ |
| `map_points` / `map_routes` / `map_events` (+dates) | only `flag_disabled = false`      | ✗          | full CRUD                               | ✓            |
| `map_point_photos`                                  | only photos of visible points     | ✗          | CRUD                                    | ✓            |
| `map_points_submissions`                            | ✗                                 | INSERT     | read + UPDATE                           | ✓            |
| `map_event_participants`                            | ✗                                 | ✗          | read only                               | ✓ (bot)      |
| `telegram_profiles`                                 | ✓                                 | ✗          | ✗                                       | ✓ (bot)      |
| `telegram_locations`                                | ✓ (safe columns, no `raw_update`) | ✗          | ✗                                       | ✓ (bot)      |
| `telegram_chats`                                    | ✗                                 | ✗          | CRUD                                    | ✓            |
| `telegram_outbound_messages`                        | ✗                                 | ✗          | read only                               | ✓ (bot)      |
| `map_news`                                          | ✗                                 | ✗          | CRUD                                    | ✓            |
| `map_admin_users`                                   | ✗                                 | ✗          | own row only                            | ✓            |

## Storage buckets

| Bucket             | Public read                 | Write         | Contents                                       |
| ------------------ | --------------------------- | ------------- | ---------------------------------------------- |
| `map-point-photos` | via public URL              | admins        | point photos, path `{point_id}/{uuid}.{ext}`   |
| `map-event-photos` | via public URL              | admins        | event photos                                   |
| `map-news-photos`  | yes (10 MiB, jpeg/png/webp) | admins        | news photos                                    |
| `telegram-avatars` | yes                         | edge function | cached Telegram avatars (no bot token in URLs) |

Every URL is built with `supabase.storage.from(bucket).getPublicUrl(path)` — bot tokens must never appear in a URL.

## Local development

```bash
supabase start      # full stack in Docker: API 54321, DB 54322, Studio 54323
supabase db reset   # recreate the local DB from migrations
supabase functions serve telegram-location-bot   # edge function with hot reload
```

More detail in [../README.md](../README.md) («Локальная разработка бэкенда»). To seed the local database from production, use the `supabase-clone-prod` skill.
