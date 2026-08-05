# Деплой, CI/CD и окружение

## Хостинг

- **Фронтенд**: Cloudflare Pages, проект `map-euc` (технический адрес `map-euc.pages.dev`), кастомный домен `map.euc.kz`. Сборка идёт в GitHub Actions, готовый `dist/` заливается через `wrangler pages deploy` (direct upload). Vite собирает с `base = /` — сайт живёт в корне домена. SPA-роутинг обеспечивает `public/_redirects` (`/* /index.html 200`), заголовки кэша — `public/_headers`; оба файла Vite копирует в `dist/` как есть.
- **Бэкенд**: облачный Supabase (PostgreSQL 17, Storage, Edge Functions).
- **Локально**: Valet proxy `map.euc.test` → `localhost:5173`; разрешённые dev-хосты: `map.euc.test`, `test.euc.kz`.

## Workflows

### `deploy.yml` — push в `main` / вручную

1. **supabase**: link по `SUPABASE_PROJECT_REF` → `supabase db push` (миграции) → `supabase functions deploy telegram-location-bot --no-verify-jwt --use-api`.
2. **deploy**: `npm run build` (только Vite — типы проверены на PR) с `VITE_*` из variables → `wrangler pages deploy dist --project-name=map-euc --branch=main` через `cloudflare/wrangler-action@v3`.
3. **notify** (`if: always()`): результат в Telegram, со ссылкой на конкретный деплой из `deployment-url`.

Секреты edge-функции (`TELEGRAM_BOT_TOKEN` и др.) в CI **не** задаются — один раз через `supabase secrets set` (см. [telegram-bot.md](telegram-bot.md)).

### Cloudflare Pages

- **Токен CI** (`CLOUDFLARE_API_TOKEN`): достаточно прав `Account → Cloudflare Pages → Edit`. Для разовых операций с доменом и DNS нужен отдельный токен с `Zone → DNS → Edit` и `Zone → Zone → Read` на зону `euc.kz` — держать его в CI не нужно.
- **Ручной деплой**: `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler@4 pages deploy dist --project-name=map-euc --branch=main`. Ветка обязательно `main` — только production-деплой попадает на кастомный домен.
- **Откат**: `npx wrangler@4 pages deployment list --project-name=map-euc`, затем «Rollback to this deployment» в дашборде. DNS при этом не трогается.
- **Почему не Git-интеграция Cloudflare**: сборка ушла бы на сторону CF, где нет `GITHUB_SHA` (из него строится версия PWA-кеша), пришлось бы дублировать семь `VITE_*` в дашборде, а job `supabase` всё равно остаётся в Actions — пайплайн расщепился бы надвое.
- **Preview-деплои выключены**: собирались бы с боевыми `VITE_SUPABASE_*`, то есть админка из превью писала бы в прод-БД. Включать только вместе с изолированным Supabase-проектом.
- **`wrangler` не в devDependencies** намеренно: тянет платформенные бинари workerd (~40–50 МБ) всем разработчикам ради одной команды в CI.

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

**Secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (уведомления CI — отдельный экземпляр, не путать с секретом edge-функции), `SUPABASE_STORAGE_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `BACKUP_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

`CLOUDFLARE_*` — только для CI, правило «синхронизировать в четырёх местах» на них не распространяется: это не переменные сборки, в `.env.example` и `build:e2e` они не нужны. Account id лежит в Secrets, а не в Variables, потому что репозиторий публичный.

## Версионирование сборки

`__APP_VERSION__` = `GITHUB_SHA` (или `Date.now()` локально) — попадает в регистрацию SW (`sw.js?v=...`) и имена кешей: каждый деплой инвалидирует PWA-кеш. Сборка остаётся в GitHub Actions именно поэтому: на стороне Cloudflare `GITHUB_SHA` не существует.

## Чеклист после деплоя

```bash
BASE=https://map.euc.kz
# Все маршруты — 200 text/html (SPA-фолбэк из _redirects)
for p in / /radar /events /m/point/1 /help /admin /no-such-page; do
  printf '%-16s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' $BASE$p)"
done
curl -sI $BASE/assets/…js | grep -i cache-control   # immutable
curl -sI $BASE/sw.js      | grep -i cache-control   # no-cache
curl -sI https://map-euc.pages.dev/radar | head -3  # 301 на map.euc.kz
```

Отдельно на устройстве с установленной PWA: приходит обновление сервис-воркера, в Cache Storage остаются только кеши с новым sha, и офлайн-переход на не посещённый ранее путь отдаёт app shell без ошибки `a redirected response was used…` в консоли.

## Локальный Supabase

```bash
supabase start    # Docker: API 54321, DB 54322, Studio 54323
supabase status   # ключи для .env.local
supabase db reset # применить миграции + seed
supabase functions serve telegram-location-bot
supabase stop
```

Облачные preview-ветки требуют платного плана — для правок бота/миграций/RLS использовать локальный стек.
