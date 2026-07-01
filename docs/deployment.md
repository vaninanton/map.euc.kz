# Деплой, CI/CD и окружение

## Хостинг

- **Фронтенд**: GitHub Pages, кастомный домен `map.euc.kz` (файл `CNAME`). При `GITHUB_PAGES=true` Vite собирает с `base = /map.euc/`; плагин `baseUrlMetaPlugin` подставляет base в OG-метатеги, `spaFallback404Plugin` копирует `index.html` → `404.html` (SPA-роутинг на Pages).
- **Бэкенд**: облачный Supabase (PostgreSQL 17, Storage, Edge Functions).
- **Локально**: Valet proxy `map.euc.test` → `localhost:5173`; разрешённые dev-хосты: `map.euc.test`, `test.euc.kz`.

## Workflows

### `deploy.yml` — push в `main` / вручную

1. **supabase**: link по `SUPABASE_PROJECT_REF` → `supabase db push` (миграции) → `supabase functions deploy telegram-location-bot --no-verify-jwt --use-api`.
2. **deploy**: `npm run build` (только Vite — типы проверены на PR) с `VITE_*` из variables → upload в GitHub Pages.
3. **notify** (`if: always()`): результат в Telegram.

Секреты edge-функции (`TELEGRAM_BOT_TOKEN` и др.) в CI **не** задаются — один раз через `supabase secrets set` (см. [telegram-bot.md](telegram-bot.md)).

### `test.yml` — PR и push в `main`

`paths-ignore`: `**/*.md`, LICENSE, `.editorconfig`, `.gitignore`, `.vscode/**`. Jobs: `checks` (lint, format:check, tsc, vitest, deno) + `e2e` (Playwright chromium) параллельно; `notify` при падении.

### `backup.yml` — ежедневно 03:00 UTC (≈08:00 Алматы) / вручную

1. **БД**: ставит `postgresql-client-17` на раннер (сервер на PG 17), `pg_dump --schema-only` и `--data-only` с `--exclude-schema` всех системных схем Supabase, gzip, проверка размера > 1 КБ.
2. **Storage**: `aws s3 sync` четырёх бакетов (`map-point-photos`, `telegram-avatars`, `map-event-photos`, `map-news-photos`) через S3-протокол Supabase Storage.
3. **Выгрузка**: в Selectel S3 (`BACKUP_S3_*`), c `--no-verify-ssl` — сертификат российского УЦ отсутствует в trust store раннера.

Восстановление и ручные дампы — скилл `supabase-backup`.

## Переменные окружения (фронтенд)

`cp .env.example .env.local`:

| Переменная                          | Назначение                          | Default |
| ----------------------------------- | ----------------------------------- | ------- |
| `VITE_MAPBOX_TOKEN`                 | Публичный токен Mapbox              | —       |
| `VITE_SUPABASE_URL`                 | URL проекта Supabase                | —       |
| `VITE_SUPABASE_PUBLISHABLE_KEY`     | Anon-ключ (RLS-protected)           | —       |
| `VITE_YANDEX_METRIKA_ID`            | Счётчик Метрики (опционально)       | пусто   |
| `VITE_TELEGRAM_GEO_TTL_MINUTES`     | Сколько минут показывать геопозиции | 60      |
| `VITE_TELEGRAM_TRACK_TAIL_MINUTES`  | Длина «хвоста» трека                | 30      |
| `VITE_TELEGRAM_MAX_ACCURACY_METERS` | Макс. погрешность GPS               | 100     |

**При добавлении переменной синхронизировать в четырёх местах**: `.github/workflows/deploy.yml`, `.env.example`, `.env.local`, `README.md`. Для e2e — ещё `build:e2e` в `package.json`.

Команды синхронизации: чувствительные → `gh secret set NAME --body "$NAME"`, некритичные → `gh variable set NAME --body "$NAME"` (шаблоны `.env.github_vars` / `.env.github_secrets`, в .gitignore).

## GitHub Variables / Secrets

**Variables**: `SUPABASE_PROJECT_REF`, все `VITE_*` из таблицы выше, `SUPABASE_STORAGE_S3_ENDPOINT/REGION`, `BACKUP_S3_BUCKET/REGION/ENDPOINT`.

**Secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (уведомления CI — отдельный экземпляр, не путать с секретом edge-функции), `SUPABASE_STORAGE_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `BACKUP_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY`.

## Версионирование сборки

`__APP_VERSION__` = `GITHUB_SHA` (или `Date.now()` локально) — попадает в регистрацию SW (`sw.js?v=...`) и имена кешей: каждый деплой инвалидирует PWA-кеш.

## Локальный Supabase

```bash
supabase start    # Docker: API 54321, DB 54322, Studio 54323
supabase status   # ключи для .env.local
supabase db reset # применить миграции + seed
supabase functions serve telegram-location-bot
supabase stop
```

Облачные preview-ветки требуют платного плана — для правок бота/миграций/RLS использовать локальный стек.
