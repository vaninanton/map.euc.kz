---
name: supabase-backup
description: Backup Supabase database for map.euc.kz. Use when asked to backup the database, dump DB, export data, create a DB snapshot, or restore from backup. Supports full schema+data dump, schema-only, and data-only modes.
---

Backup the Supabase PostgreSQL database for map.euc.kz. The workflow uses `pg_dump` directly with connection credentials from `supabase db dump --dry-run` (Docker is not required).

## Project info

- **Reference ID**: `sbfnottcjbbgoucfwbzs`
- **Region**: North EU (Stockholm)
- **Backup dir**: `supabase/backups/` (gitignored — may contain sensitive data)

## Process

### 1. Ensure CLI is linked

```bash
supabase projects list
```

The project `map.euc.kz` must show `●` (linked). If not:

```bash
supabase link --project-ref sbfnottcjbbgoucfwbzs
```

### 2. Create backup directory and ensure gitignore

```bash
mkdir -p /private/var/www/map.euc/supabase/backups
grep -q 'supabase/backups' /private/var/www/map.euc/.gitignore || echo 'supabase/backups/' >> /private/var/www/map.euc/.gitignore
```

### 3. Get connection credentials

`supabase db dump --linked` requires Docker and will fail if Docker Desktop is not running. Instead, extract credentials from the dry-run output (no Docker needed):

```bash
supabase db dump --linked --dry-run 2>&1 | grep -E "^export PG"
```

This prints the live session credentials:
```
export PGHOST="aws-1-eu-north-1.pooler.supabase.com"
export PGPORT="5432"
export PGUSER="cli_login_postgres.sbfnottcjbbgoucfwbzs"
export PGPASSWORD="<session-token>"
export PGDATABASE="postgres"
```

Credentials are session-scoped and rotate — always fetch fresh from `--dry-run`, never hardcode.

### 4. Run the dump

Full dump (schema + data) — **default, use unless told otherwise**:

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/private/var/www/map.euc/supabase/backups/backup_${TIMESTAMP}.sql"

# Read fresh credentials
eval "$(supabase db dump --linked --dry-run 2>/dev/null | grep "^export PG")"

# Schema
pg_dump \
    --schema-only \
    --quote-all-identifier \
    --role "postgres" \
    --exclude-schema "information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault" \
    -f "${BACKUP_FILE}.schema"

# Data
pg_dump \
    --data-only \
    --quote-all-identifier \
    --role "postgres" \
    --exclude-schema "information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault" \
    -f "${BACKUP_FILE}.data"

# Combine
cat "${BACKUP_FILE}.schema" "${BACKUP_FILE}.data" > "${BACKUP_FILE}"
rm "${BACKUP_FILE}.schema" "${BACKUP_FILE}.data"
```

Schema only (no data — good for migration audits):

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
eval "$(supabase db dump --linked --dry-run 2>/dev/null | grep "^export PG")"
pg_dump \
    --schema-only --quote-all-identifier --role "postgres" \
    --exclude-schema "information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault" \
    -f "/private/var/www/map.euc/supabase/backups/schema_${TIMESTAMP}.sql"
```

Data only (no DDL — useful for seeding):

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
eval "$(supabase db dump --linked --dry-run 2>/dev/null | grep "^export PG")"
pg_dump \
    --data-only --quote-all-identifier --role "postgres" \
    --exclude-schema "information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault" \
    -f "/private/var/www/map.euc/supabase/backups/data_${TIMESTAMP}.sql"
```

### 5. Verify the dump

```bash
# Check file size (should be > 0, full dump ~70+ MB)
ls -lh "/private/var/www/map.euc/supabase/backups/backup_${TIMESTAMP}.sql"

# Check it starts with expected SQL header
head -5 "/private/var/www/map.euc/supabase/backups/backup_${TIMESTAMP}.sql"

# Count table dumps (expect ~7: 6 project tables + spatial_ref_sys from PostGIS)
grep -c "^COPY " "/private/var/www/map.euc/supabase/backups/backup_${TIMESTAMP}.sql" || true
```

### 6. Report

Tell the user:
- File path and size
- Number of `COPY` statements (tables dumped)
- Timestamp of the backup

## Tables in this project

| Table | Description |
|---|---|
| `map_points` | Verified map points (встречи, розетки и т.д.) |
| `map_routes` | Routes / маршруты |
| `map_point_photos` | Photos attached to map points |
| `map_points_submissions` | Moderation queue — pending point submissions |
| `telegram_locations` | Real-time rider locations from Telegram |
| `telegram_profiles` | Telegram user profiles + avatar cache |

## Gitignore note

Add `supabase/backups/` to `.gitignore` — backups contain personal data (Telegram user IDs, coordinates):

```bash
grep -q 'supabase/backups' .gitignore || echo 'supabase/backups/' >> .gitignore
```

## Restoring from backup

**Caution: this overwrites data in the target DB.**

```bash
# Restore to local Supabase instance (supabase start must be running)
psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/backups/backup_TIMESTAMP.sql
```

For remote restores, prefer the Supabase dashboard UI (Database → Backups) to avoid accidentally targeting the wrong project.

## Troubleshooting

- **`failed to inspect docker image` / Docker error** — `supabase db dump --linked` requires Docker. Use the `pg_dump` approach via `--dry-run` credentials instead (see Step 3).
- **`supabase db dump: error: not logged in`** — run `supabase login` first
- **`project not linked`** — run `supabase link --project-ref sbfnottcjbbgoucfwbzs`
- **Empty `--dry-run` output** — check `supabase projects list`; try `supabase db dump --linked --dry-run --debug`
- **`pg_dump: error: query failed`** — session token may have expired; re-run the `--dry-run` step to get fresh credentials
- **Large dump takes >60s** — `telegram_locations` can have many rows; this is normal
