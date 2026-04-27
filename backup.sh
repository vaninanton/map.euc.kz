source .env.local
pg_dump -n public --schema-only $BACKUP_DATABASE_URL > backup_schema.sql && pg_dump -n public --data-only $BACKUP_DATABASE_URL > backup_data.sql
