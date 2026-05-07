# Мономаршруты — map.euc.kz

Интерактивная карта точек, розеток и маршрутов для райдеров на моноколёсах в Алматы. Помогает планировать поездки, находить места встреч и розетки для подзарядки, а также видеть геопозиции участников Telegram-чатов и сеть городских велодорожек.

Доступно по адресу: [https://map.euc.kz](https://map.euc.kz)

## Основной функционал

Веб-приложение представляет собой одностраничный PWA на базе Mapbox GL JS с несколькими тематическими слоями, которые пользователь может включать и выключать независимо.

**Слои карты:**

- **Точки** — места встреч, парковки, точки интереса для райдеров.
- **Розетки** — публичные точки подзарядки моноколёс.
- **Маршруты** — заранее проложенные треки для покатушек.
- **Велодорожки** — сеть велоинфраструктуры Алматы (данные проекта Velojol).
- **Геопозиции из чатов (Telegram)** — актуальные геопозиции участников из подключённых Telegram-чатов и их недавние треки.

**Возможности интерфейса:**

- Переключение между стилями подложки: «Карта» (Mapbox Streets) и «Спутник».
- Сайдбар с подробной информацией по выбранной фиче (точке, маршруту, велодорожке или райдеру), включая фотогалерею.
- Шаринг состояния через hash: ссылка вида `#point-123` открывает карту с предвыбранной точкой и автозумом.
- Поддержка офлайна и установки как PWA: service worker, иконки, splash-screens для всех актуальных моделей iPhone/iPad.
- Запоминание выбора видимости слоёв в `localStorage`.
- Быстрая кнопка «Обновить страницу» при ошибке с полным сбросом кеша, IndexedDB и service worker.
- Hover- и click-эффекты с подсветкой и затемнением остальных фич через `feature-state`.
- Корректные отступы под safe-area iOS (notch, home indicator).

**Добавление точек пользователями:**

Любой посетитель может предложить новую точку или розетку. Координаты выбираются кликом по карте, после чего форма отправляет заявку в таблицу `map_points_submissions` для модерации. Опубликованные модератором точки попадают в основной слой.

**Сбор геопозиций из Telegram:**

В составе проекта работает Edge Function `telegram-location-bot` — webhook для Telegram-бота. Бот, добавленный в чат райдеров, получает обновления и сохраняет сообщения с `location` в таблицу `telegram_locations`, попутно подтягивая профиль пользователя (никнейм, имя, аватар) в `telegram_profiles`. На карте показываются только свежие точки (TTL и максимальная допустимая погрешность настраиваются через переменные окружения).

## Технологический стек

- **Frontend:** React 19, TypeScript, Vite 8, TailwindCSS 4.
- **Карта:** Mapbox GL JS 3 с пользовательским стилем.
- **Backend / БД:** Supabase (PostgreSQL + Row Level Security + Storage + Edge Functions на Deno).
- **Аналитика:** Яндекс.Метрика (опционально).
- **Качество кода:** ESLint, Prettier, Vitest для unit-тестов.
- **Деплой:** GitHub Pages с кастомным доменом `map.euc.kz` (см. `CNAME`).

## Структура проекта

```
src/
├── components/      # React-компоненты (EucMap, FeatureSidebar, LayerControls, AddPointPanel, …)
├── hooks/           # Хуки: useMapbox, useLayers, useMapClick, useMapHover,
│                    #        useHashSelectionSync, useSelectedFeatureState
├── lib/             # Низкоуровневые обёртки: supabase.ts, mapLayers.ts
├── utils/           # Геометрия, hash-навигация, popup, гварды, share-ссылки
├── constants/       # ID слоёв, источники, цвета, центр карты
├── types/           # Типы GeoJSON, Supabase, velojol
├── data/            # Статичные данные (almaty.json — велодорожки)
├── index.css
└── main.tsx
supabase/
├── migrations/      # Миграции схемы (map_points, map_routes, telegram_locations, …)
├── functions/
│   └── telegram-location-bot/   # Edge Function: приём webhook-ов от Telegram
└── seed.sql
public/              # Статика PWA: манифест, иконки, splash, sw.js
```

## Быстрый старт

Требуется Node.js 20+ и npm.

```bash
# Установка зависимостей
npm install

# Конфигурация окружения
cp .env.example .env.local
# и заполните VITE_MAPBOX_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

# Запуск dev-сервера
npm run dev

# Сборка production-бандла
npm run build

# Локальный preview собранной версии
npm run preview

# Тесты и линт
npm test
npm run lint
```

### Переменные окружения

| Переменная                          | Назначение                                                  |
| ----------------------------------- | ----------------------------------------------------------- |
| `VITE_MAPBOX_TOKEN`                 | Публичный токен Mapbox для рендеринга карты.                |
| `VITE_SUPABASE_URL`                 | URL проекта Supabase.                                       |
| `VITE_SUPABASE_PUBLISHABLE_KEY`     | Anon-ключ Supabase для чтения публичных данных.             |
| `VITE_YANDEX_METRIKA_ID`            | ID счётчика Яндекс.Метрики (необязательно).                 |
| `VITE_TELEGRAM_GEO_TTL_MINUTES`     | Сколько минут показывать геопозиции Telegram-пользователей. |
| `VITE_RADAR_TTL_MINUTES`            | Сколько минут показывать райдеров на радаре (по умолчанию — из `VITE_TELEGRAM_GEO_TTL_MINUTES` или 30). |
| `VITE_TELEGRAM_TRACK_TAIL_MINUTES`  | Длина «хвоста» трека по времени.                            |
| `VITE_TELEGRAM_MAX_ACCURACY_METERS` | Максимально допустимая погрешность координат, м.            |

## Админка карты

Маршрут `/admin` (на проде с учётом `base`, например `https://map.euc.kz/admin`): модерация заявок, CRUD точек и маршрутов, фото точек. Доступ только через **Supabase Auth** и запись в таблице **`map_admin_users`** — секретный `service_role` ключ в браузере **не используется** (Supabase его блокирует).

### Настройка один раз

1. В Supabase включите провайдер **Email** (Authentication → Providers → Email).
2. Создайте пользователя (Authentication → Users → Add user) или зарегистрируйтесь через включённый signup — как удобнее для вашего проекта.
3. Узнайте `uuid` пользователя в списке Users.
4. Примените миграции (`supabase db push` или через Dashboard → SQL), затем выдайте права администратора:

    ```sql
    INSERT INTO public.map_admin_users (user_id)
    VALUES ('<uuid-пользователя-из-auth-users>')
    ON CONFLICT (user_id) DO NOTHING;
    ```

5. Откройте `/admin`, войдите email/паролём.

Загрузка фото в Storage разрешена только администраторам (RLS на `storage.objects` и таблицы данных). Публичная анонимная загрузка в бакет точек отключена миграцией.

SPA на GitHub Pages: в `dist/` появляется `404.html` (копия `index.html`), чтобы прямые переходы по путям отдавали приложение и React Router обрабатывал маршруты.

## Telegram-бот для сбора геопозиций

Реализован через Edge Function `telegram-location-bot`. Он принимает `update` от Telegram и сохраняет сообщения с `location` в таблицу `telegram_locations`. Аватары пользователей сохраняются в Storage-бакет `telegram-avatars`, а в `telegram_profiles.avatar_url` хранится безопасный public URL без bot token.

Развёртывание:

1. Задайте секреты для функции:
    ```bash
    supabase secrets set TELEGRAM_BOT_TOKEN=<bot_token> \
      TELEGRAM_WEBHOOK_SECRET=<random_secret> \
      TELEGRAM_BACKFILL_SECRET=<другой_секрет_только_для_backfill>
    ```
   Опционально: `TELEGRAM_BACKFILL_MAX_PROFILES` — лимит профилей за один вызов backfill (по умолчанию 500).
2. Задеплойте функцию (на проде при каждом push в `main` это делает GitHub Actions; вручную — например для первого запуска или отладки):
    ```bash
    supabase functions deploy telegram-location-bot --no-verify-jwt --use-api
    ```
3. Подключите webhook у бота (без передачи bot token в URL):
    ```bash
    curl -X POST "https://api.telegram.org/bot<bot_token>/setWebhook" \
      -H "Content-Type: application/json" \
      -d '{"url":"https://<project-ref>.supabase.co/functions/v1/telegram-location-bot","secret_token":"<random_secret>"}'
    ```

После этого любые сообщения с геопозицией в чате, где есть бот, будут попадать в `telegram_locations` и автоматически отображаться на карте.

### Обновление аватаров для уже существующих профилей

Если нужно переобновить аватары для уже заполненных `telegram_profiles` (например, после security-фикса), запустите backfill:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/telegram-location-bot/backfill" \
  -H "x-telegram-backfill-secret: <TELEGRAM_BACKFILL_SECRET>"
```

Если ответ содержит `capped_at_max_profiles: true`, повторите запрос с параметром `?from=<next_from>` из JSON (продолжение по порядку строк).

Функция пройдёт по `telegram_profiles` и обновит только небезопасные/пустые `avatar_url`.

## База данных (Supabase)

Основные таблицы:

- `map_points` — точки и розетки (тип `point_types`: `point` / `socket`), флаги «место встречи», «есть розетка», «скрыта».
- `map_routes` — маршруты как `LineString` в массиве координат.
- `map_points_submissions` — заявки на добавление точек от пользователей (модерация).
- `map_point_photos` — фотографии точек, файлы лежат в Storage-бакете.
- `map_admin_users` — пользователи Supabase Auth с правами администратора карты (заполняется вручную).
- `telegram_locations` — геопозиции из Telegram (полный payload хранится в `raw_update`, но анонимному ключу выдан SELECT только по безопасным колонкам без `raw_update`).
- `telegram_profiles` — кэш профилей Telegram (имя, ник, аватар).

Все публичные таблицы защищены RLS и доступны на чтение анонимно только для записей с `flag_disabled = false`.

## Генерация PWA-ассетов

Иконки и splash-screens генерируются из `public/favicon.svg`:

```bash
npm run generate:pwa-icons
npm run generate:pwa-startup
```

## Деплой

Сборка для GitHub Pages:

```bash
GITHUB_PAGES=true npm run build
```

При сборке в режиме GitHub Pages `vite.config.ts` подменяет `base` на `/map.euc/`, а плагин `baseUrlMetaPlugin` подставляет корректные абсолютные URL в OG-метатеги `index.html`. Кастомный домен закреплён файлом `CNAME`.

### CI: Supabase (миграции и Edge Functions)

Workflow `.github/workflows/deploy.yml` перед сборкой фронтенда:

1. Выполняет **`supabase db push`** к проекту (версия CLI берётся из `package-lock.json`, см. зависимость `supabase`).
2. Деплоит Edge Function **`telegram-location-bot`** командой `supabase functions deploy telegram-location-bot --no-verify-jwt --use-api` (`--no-verify-jwt` нужен для webhook Telegram без JWT; `--use-api` — сборка функции на стороне Supabase без Docker на раннере).

Секреты самой функции (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, …) в CI **не задаются**: их один раз прописывают в проекте через `supabase secrets set` или Dashboard (см. раздел «Telegram-бот» выше). Деплой только обновляет код функции.

В настройках репозитория GitHub нужны:

| GitHub Variables | Значение |
| ---------------- | -------- |
| `SUPABASE_PROJECT_REF` | Идентификатор проекта из URL дашборда: `https://app.supabase.com/project/<SUPABASE_PROJECT_REF>` (совпадает с поддоменом `https://<SUPABASE_PROJECT_REF>.supabase.co`). |
| `VITE_MAPBOX_TOKEN` | Публичный токен Mapbox (см. раздел «Переменные окружения»). |
| `VITE_SUPABASE_URL` | URL проекта Supabase. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon / publishable-ключ. |
| `VITE_YANDEX_METRIKA_ID` | ID Яндекс.Метрики; допускается пустая строка. |
| `VITE_TELEGRAM_GEO_TTL_MINUTES` | TTL геометок Telegram на карте. |
| `VITE_TELEGRAM_TRACK_TAIL_MINUTES` | Длина «хвоста» трека. |
| `VITE_TELEGRAM_MAX_ACCURACY_METERS` | Макс. погрешность координат, м. |

| GitHub Secrets | Значение |
| -------------- | -------- |
| `SUPABASE_ACCESS_TOKEN` | [Personal access token](https://supabase.com/dashboard/account/tokens) Supabase. |
| `SUPABASE_DB_PASSWORD` | Пароль базы данных проекта (Settings → Database). |
| `TELEGRAM_BOT_TOKEN` | Токен бота для уведомлений о результате деплоя в Actions (не путать с секретом Edge Function — там свой экземпляр в Supabase). |
| `TELEGRAM_CHAT_ID` | Чат или канал для этих уведомлений. |

Локальные шаблоны со списком имён (в `.gitignore`, не коммитятся): `.env.github_vars`, `.env.github_secrets`.

#### Синхронизация переменных и секретов через [`gh`](https://cli.github.com/)

Из корня репозитория, после заполнения файлов:

**Variables** (репозиторий по умолчанию; для другого репозитория добавьте `-R owner/repo`):

```bash
set -a
source .env.github_vars
set +a

gh variable set SUPABASE_PROJECT_REF --body "$SUPABASE_PROJECT_REF"
gh variable set VITE_MAPBOX_TOKEN --body "$VITE_MAPBOX_TOKEN"
gh variable set VITE_SUPABASE_URL --body "$VITE_SUPABASE_URL"
gh variable set VITE_SUPABASE_PUBLISHABLE_KEY --body "$VITE_SUPABASE_PUBLISHABLE_KEY"
gh variable set VITE_YANDEX_METRIKA_ID --body "$VITE_YANDEX_METRIKA_ID"
gh variable set VITE_TELEGRAM_GEO_TTL_MINUTES --body "$VITE_TELEGRAM_GEO_TTL_MINUTES"
gh variable set VITE_TELEGRAM_TRACK_TAIL_MINUTES --body "$VITE_TELEGRAM_TRACK_TAIL_MINUTES"
gh variable set VITE_TELEGRAM_MAX_ACCURACY_METERS --body "$VITE_TELEGRAM_MAX_ACCURACY_METERS"
```

**Secrets:**

```bash
set -a
source .env.github_secrets
set +a

gh secret set SUPABASE_ACCESS_TOKEN --body "$SUPABASE_ACCESS_TOKEN"
gh secret set SUPABASE_DB_PASSWORD --body "$SUPABASE_DB_PASSWORD"
gh secret set TELEGRAM_BOT_TOKEN --body "$TELEGRAM_BOT_TOKEN"
gh secret set TELEGRAM_CHAT_ID --body "$TELEGRAM_CHAT_ID"
```
