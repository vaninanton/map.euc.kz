#!/bin/sh
# Заливает секреты edge-функций в Supabase из .env.local (только заполненные).
# SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY платформа задаёт автоматически — их не трогаем.
set -e
cd "$(dirname "$0")/.."

# telegram-location-bot: TELEGRAM_*, MAP_BASE_URL; ai-assist: OPENAI_*
SECRET_VARS="TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET TELEGRAM_BACKFILL_SECRET TELEGRAM_BACKFILL_MAX_PROFILES MAP_BASE_URL OPENAI_API_KEY OPENAI_MODEL"

if [ ! -f .env.local ]; then
    echo "Ошибка: нет .env.local (скопируйте .env.example и заполните)." >&2
    exit 1
fi

set -a
. ./.env.local
set +a

set --
for name in $SECRET_VARS; do
    eval "value=\${$name:-}"
    if [ -n "$value" ]; then
        set -- "$@" "$name=$value"
        echo "→ $name"
    fi
done

if [ $# -eq 0 ]; then
    echo "Ошибка: в .env.local не заполнена ни одна из переменных: $SECRET_VARS" >&2
    exit 1
fi

supabase secrets set "$@"
echo "Обновлено секретов: $#."
