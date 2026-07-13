---
name: supabase-clone-prod
description: Refresh the local Supabase dev stack for map.euc.kz — schema from migrations, data seeded from production. Use when asked to copy/mirror/sync/pull prod data to local, refresh the local DB, regenerate the seed, reset local from prod, or "продублировать supabase с прода на локаль". Requires Docker running.
---

Set up the **local** Supabase dev stack for map.euc.kz so it matches how the app is actually built and deployed:

- **Schema comes from migrations** (`supabase db reset` applies `supabase/migrations/`) — the local schema is exactly what CI builds, so migration drift surfaces locally instead of at deploy time.
- **Data comes from production**, captured once into `supabase/seed.sql`, which `db reset` auto-loads on every reset.

This is deliberately **not** a raw `pg_dump` clone of prod's live schema. A live-schema clone bypasses migrations and hides drift; keeping schema-from-migrations + data-as-seed is the supabase-recommended dev flow. (If the user ever explicitly wants prod's *live* schema — e.g. to debug a migration that hasn't landed — that's a different, one-off `pg_dump --schema-only` job; note it and confirm before doing it.)

## Project info

- **Prod reference ID**: `sbfnottcjbbgoucfwbzs` (map.euc.kz, North EU / Stockholm)
- **Local DB**: `postgresql://postgres:postgres@localhost:54322/postgres` (port from `supabase/config.toml`)
- **Seed file**: `supabase/seed.sql` — **gitignored** (contains prod PII: Telegram user IDs, coordinates, avatars)
- **Studio**: `http://localhost:54323`

Public tables cloned: `map_points`, `map_routes`, `map_point_photos`, `map_points_submissions`, `telegram_locations`, `telegram_profiles`, `map_admin_users`, `map_events`, `map_event_dates`, `map_event_participants`, `map_news`, `telegram_chats`, `telegram_outbound_messages`.

> Data is copied **as-is**, PII included. The seed file must stay out of git. Prod is only ever read (`pg_dump`) — this skill never writes to prod.

## When to run which part

- **First-time setup / refresh prod data** → run the whole thing (regenerate seed, then reset).
- **Just re-seed local after a schema/migration change** → skip step 4; run `supabase db reset` (step 5), which reuses the existing `seed.sql`.

## Process

### 1. Prerequisites

```bash
docker info >/dev/null 2>&1 || echo "❌ Docker is not running — start Docker Desktop first"
supabase projects list   # map.euc.kz must show ● (linked)
```

If not linked: `supabase link --project-ref sbfnottcjbbgoucfwbzs`. If Docker is down, stop and tell the user — the local stack needs it.

### 2. Confirm seed.sql is gitignored

The seed holds prod PII and must never be committed:

```bash
grep -q '^supabase/seed.sql' /private/var/www/map.euc/.gitignore || \
  echo 'supabase/seed.sql' >> /private/var/www/map.euc/.gitignore
```

> ⚠️ Supabase's default `config.toml` seeds `supabase/seed.sql` automatically. If `[db.seed]` in `config.toml` points elsewhere or is disabled, either re-enable it or adjust the target path in step 4 accordingly. Check with `grep -A3 '\[db.seed\]' supabase/config.toml`.

### 3. Start the local stack

```bash
supabase start   # idempotent — prints status if already running
```

### 4. Generate `supabase/seed.sql` from prod (data only)

Fetch fresh prod credentials (session-scoped, rotate — never hardcode), then dump **data only**:

```bash
SEED="/private/var/www/map.euc/supabase/seed.sql"
EXCLUDE="information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault"

# Fresh prod creds into PG* env vars (prod connection, current shell only)
eval "$(supabase db dump --linked --dry-run 2>/dev/null | grep '^export PG')"

# Data-only dump → seed.sql. --disable-triggers so FK order / triggers don't block the reset-load.
pg_dump --data-only --disable-triggers --quote-all-identifier --role postgres \
    --exclude-schema "$EXCLUDE" -f "$SEED"

ls -lh "$SEED" && head -20 "$SEED"
```

Notes:
- `--data-only` keeps the file schema-free, so it composes cleanly with migration-built tables.
- `--disable-triggers` loads as superuser (local `postgres` qualifies) and sidesteps FK-ordering failures.
- Prod credentials rotate — if a later step fails with `query failed`, re-run this `eval` line for fresh creds.

### 5. Reset local: apply migrations, then load the seed

```bash
supabase db reset
```

This drops the local DB, replays every file in `supabase/migrations/` (schema = CI), then loads `supabase/seed.sql` (prod data). One command does schema **and** data.

### 6. Verify

```bash
LOCAL="postgresql://postgres:postgres@localhost:54322/postgres"
psql "$LOCAL" -c "\dt public.*"
psql "$LOCAL" -c "SELECT 'map_points' t, count(*) FROM map_points
  UNION ALL SELECT 'map_routes', count(*) FROM map_routes
  UNION ALL SELECT 'telegram_locations', count(*) FROM telegram_locations
  UNION ALL SELECT 'map_events', count(*) FROM map_events;"
```

Compare to prod (PG* env vars from step 4 still point at prod in this shell):

```bash
psql -c "SELECT count(*) FROM public.map_points;"   # prod
```

Counts should match. Also open Studio (`http://localhost:54323`) for a visual sanity check.

### 7. Report

Tell the user:
- Local stack status + DB URL
- Row counts per key table (local vs prod — confirm they match)
- Reminder that `seed.sql` is gitignored and holds prod PII
- Studio URL

## Notes & caveats

- **Storage files (photos/avatars) are NOT copied.** DB rows referencing them are seeded, and their public URLs still point at prod Storage (so images render), but local uploads/deletes won't touch prod buckets. Mirroring bucket contents is a separate `supabase storage` job — ask before attempting.
- **Auth users aren't copied** (auth schema excluded). `map_admin_users` rows are seeded but the matching `auth.users` won't exist locally. For local admin login, create a local auth user via Studio.
- **Re-seeding is cheap and repeatable.** Any `supabase db reset` reloads `seed.sql`. Refresh prod data by re-running step 4 when it goes stale.
- **Big tables.** `telegram_locations` can be large; a big `seed.sql` slows every `db reset`. If it gets unwieldy, consider a `LIMIT`ed or time-windowed dump for that one table (a `COPY (SELECT ... WHERE ts > now()-interval '30 days') TO STDOUT` appended to the seed) — mention this option if resets get slow.

## Troubleshooting

- **`Cannot connect to the Docker daemon`** — start Docker Desktop, re-run from step 3.
- **`not logged in`** — `supabase login`.
- **`project not linked`** — `supabase link --project-ref sbfnottcjbbgoucfwbzs`.
- **Empty `--dry-run` output** — check `supabase projects list`; retry with `--debug`.
- **`pg_dump: query failed` mid-dump** — prod session token expired; re-run the `eval` in step 4.
- **`db reset` errors while loading seed** — a table in `seed.sql` may not exist in migrations (schema drift), or FK order failed. Confirm the table exists in `supabase/migrations/`; ensure the dump used `--disable-triggers`.
- **Seed not loaded after reset** — check `[db.seed]` in `config.toml` is enabled and points at `supabase/seed.sql` (see step 2 warning).
