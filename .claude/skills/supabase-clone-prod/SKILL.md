---
name: supabase-clone-prod
description: Refresh the local Supabase dev stack for map.euc.kz — schema from migrations, data pulled from production. Use when asked to copy/mirror/sync/pull prod data to local, refresh the local DB, regenerate the local dataset, reset local from prod, or "продублировать supabase с прода на локаль". Requires Docker running.
---

Set up the **local** Supabase dev stack for map.euc.kz so it matches how the app is actually built and deployed:

- **Schema comes from migrations** (`supabase db reset` applies `supabase/migrations/`) — the local schema is exactly what CI builds, so migration drift surfaces locally instead of at deploy time.
- **Data comes from production**, captured into a gitignored dump and loaded into the local database after the reset.

This is deliberately **not** a raw `pg_dump` clone of prod's live schema. A live-schema clone bypasses migrations and hides drift; keeping schema-from-migrations + data-loaded-separately is the Supabase-recommended dev flow. (If the user ever explicitly wants prod's _live_ schema — e.g. to debug a migration that hasn't landed — that is a different, one-off `pg_dump --schema-only` job; say so and confirm before doing it.)

## ⚠️ Do not overwrite `supabase/seed.sql`

`supabase/seed.sql` is **tracked in git** (it is explicitly un-ignored by `!supabase/seed.sql` in `.gitignore`) and holds a small curated, PII-free dataset — `map_points` and `map_routes` only. `config.toml` loads it on every `db reset` via `sql_paths = ["./seed.sql"]`, which is what gives a fresh clone of the repo usable local data.

A full production dump contains `telegram_locations` and `telegram_profiles` — real user IDs, coordinates and avatars. Writing that into `supabase/seed.sql` would stage prod PII into a tracked file, and adding the path to `.gitignore` would **not** protect it, because gitignore has no effect on files git already tracks.

So: the prod dump always goes to `supabase/backups/` (gitignored as a directory) and is loaded with `psql` as a separate step.

## Project info

- **Prod reference ID**: `sbfnottcjbbgoucfwbzs` (map.euc.kz, North EU / Stockholm)
- **Local DB**: `postgresql://postgres:postgres@localhost:54322/postgres` (port from `supabase/config.toml`)
- **Prod dump target**: `supabase/backups/prod-data_<timestamp>.sql` — gitignored, contains PII
- **Studio**: `http://localhost:54323`

Public tables cloned: `map_points`, `map_routes`, `map_point_photos`, `map_points_submissions`, `telegram_locations`, `telegram_profiles`, `map_admin_users`, `map_events`, `map_event_dates`, `map_event_participants`, `map_news`, `telegram_chats`, `telegram_outbound_messages`.

> Data is copied **as-is**, PII included. Prod is only ever read (`pg_dump`) — this skill never writes to prod.

## When to run which part

- **First-time setup / refresh prod data** → run the whole thing.
- **Just rebuild local after a schema/migration change** → run `supabase db reset` (step 5) on its own; it replays the migrations and reloads the curated `seed.sql`. Re-run step 6 if you also want the prod data back.

## Process

### 1. Prerequisites

```bash
docker info >/dev/null 2>&1 || echo "❌ Docker is not running — start Docker Desktop first"
supabase projects list   # map.euc.kz must show ● (linked)
```

If it is not linked: `supabase link --project-ref sbfnottcjbbgoucfwbzs`. If Docker is down, stop and tell the user — the local stack needs it.

### 2. Confirm the dump target is gitignored

```bash
cd /private/var/www/map.euc
mkdir -p supabase/backups
git check-ignore -q supabase/backups/probe.sql && echo "✅ backups/ is ignored" || echo "❌ STOP: supabase/backups is not gitignored"
```

Do not continue if that prints ❌ — the dump would otherwise be stageable.

### 3. Start the local stack

```bash
supabase start   # idempotent — prints status if already running
```

### 4. Dump production data (data only)

Fetch fresh prod credentials (session-scoped, they rotate — never hardcode them), then dump **data only**:

```bash
cd /private/var/www/map.euc
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP="supabase/backups/prod-data_${TIMESTAMP}.sql"
EXCLUDE="information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault"

# Fresh prod creds into PG* env vars (prod connection, current shell only)
eval "$(supabase db dump --linked --dry-run 2>/dev/null | grep '^export PG')"

# Data-only dump. --disable-triggers so FK order / triggers don't block the load.
pg_dump --data-only --disable-triggers --quote-all-identifier --role postgres \
    --exclude-schema "$EXCLUDE" -f "$DUMP"

ls -lh "$DUMP" && head -20 "$DUMP"
```

Notes:

- `--data-only` keeps the file schema-free, so it composes cleanly with migration-built tables.
- `--disable-triggers` loads as superuser (the local `postgres` role qualifies) and sidesteps FK-ordering failures.
- Prod credentials rotate — if a later step fails with `query failed`, re-run the `eval` line for fresh creds.

### 5. Reset local: apply migrations

```bash
supabase db reset
```

This drops the local database, replays every file in `supabase/migrations/` (schema = CI), then loads the curated `supabase/seed.sql`.

### 6. Load the production data on top

The curated seed and the prod dump both insert into `map_points`/`map_routes`, so clear those first to avoid duplicates, then load:

```bash
LOCAL="postgresql://postgres:postgres@localhost:54322/postgres"
psql "$LOCAL" -c "TRUNCATE map_points, map_routes RESTART IDENTITY CASCADE;"
psql "$LOCAL" -v ON_ERROR_STOP=1 -f "$DUMP"
```

`TRUNCATE ... CASCADE` also clears `map_point_photos` and the event links that reference those points — the dump repopulates them.

### 7. Verify

```bash
psql "$LOCAL" -c "\dt public.*"
psql "$LOCAL" -c "SELECT 'map_points' t, count(*) FROM map_points
  UNION ALL SELECT 'map_routes', count(*) FROM map_routes
  UNION ALL SELECT 'telegram_locations', count(*) FROM telegram_locations
  UNION ALL SELECT 'map_events', count(*) FROM map_events;"
```

Compare with prod (the PG* env vars from step 4 still point at prod in this shell):

```bash
psql -c "SELECT count(*) FROM public.map_points;"   # prod
```

Counts should match. Also open Studio (`http://localhost:54323`) for a visual sanity check.

### 8. Report

Tell the user:

- Local stack status + DB URL
- Row counts per key table (local vs prod — confirm they match)
- The dump path, that it holds prod PII, and that it is gitignored
- A reminder that `supabase/seed.sql` was left untouched
- Studio URL

## Notes & caveats

- **Storage files (photos/avatars) are NOT copied.** The DB rows referencing them are loaded and their public URLs still point at prod Storage (so images render), but local uploads/deletes will not touch prod buckets. Mirroring bucket contents is a separate `supabase storage` job — ask before attempting it.
- **Auth users are not copied** (the auth schema is excluded). `map_admin_users` rows load, but the matching `auth.users` will not exist locally. For local admin login, create a local auth user through Studio.
- **Repeatable.** `supabase db reset` always gets you back to migrations + the curated seed; re-run step 6 to layer prod data back on.
- **Big tables.** `telegram_locations` can be large. If the load gets slow, dump that one table time-windowed instead (`COPY (SELECT ... WHERE created_at > now() - interval '30 days') TO STDOUT`) — mention this option if it becomes a problem.
- **Old dumps accumulate** in `supabase/backups/`. They are gitignored but still PII on disk; offer to delete stale ones.

## Troubleshooting

- **`Cannot connect to the Docker daemon`** — start Docker Desktop, re-run from step 3.
- **`not logged in`** — `supabase login`.
- **`project not linked`** — `supabase link --project-ref sbfnottcjbbgoucfwbzs`.
- **Empty `--dry-run` output** — check `supabase projects list`; retry with `--debug`.
- **`pg_dump: query failed` mid-dump** — the prod session token expired; re-run the `eval` in step 4.
- **Duplicate key errors while loading the dump** — the curated seed data was not truncated first; re-run step 6 from the `TRUNCATE`.
- **A table in the dump does not exist locally** — schema drift: the migration for it is missing from `supabase/migrations/`. Fix the migration rather than hand-patching the local DB.
