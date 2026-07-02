# Мономаршруты — map.euc.kz

Интерактивная карта точек, розеток и маршрутов для райдеров на моноколёсах в Алматы. Помогает планировать поездки, находить места встреч и розетки для подзарядки, а также видеть геопозиции участников Telegram-чатов в реальном времени и сеть городских велодорожек.

**Ссылка:** https://map.euc.kz  
**Статус:** Production (React 19 + Mapbox GL + Supabase + PWA)  
**Архитектура:** Подробно описана в [docs/](docs/README.md) — для новых инженеров и архитектурных обзоров. Правила разработки — в [AGENTS.md](AGENTS.md).

## Основной функционал

Одностраничный PWA на базе Mapbox GL JS с несколькими тематическими слоями. Статические данные (точки, маршруты) кэшируются агрессивно; только Telegram-локации обновляются в реальном времени через Supabase Realtime (обновление <500ms).

### Слои карты

- **Точки** — места встреч, парковки, точки интереса (модерируются администратором).
- **Розетки** — публичные точки подзарядки моноколёс.
- **Маршруты** — заранее проложенные треки для покатушек (с опциональными высотами).
- **Велодорожки** — сеть велоинфраструктуры Алматы (статический датасет Velojol).
- **Геопозиции Telegram** — живые геопозиции райдеров из подключённых чатов + недавние треки (TTL-фильтр, точность фильтр).

### Интерфейс

- **Переключение подложки:** Карта (Mapbox Streets) ↔ Спутник (сохраняется в localStorage).
- **Детали фичи:** Сайдбар с информацией, фотогалерея, координаты, поделиться ссылкой.
- **Deep links:** `/m/point/11`, `/m/route/5` — прямая ссылка на фичу с автозумом (легаси `#point=11` редиректится); события — `/events/:id`.
- **Offline-first:** Service Worker кэширует app shell, статические ассеты, Mapbox-тайлы. Карта работает офлайн.
- **PWA:** Установима на iOS/Android (splash-screens для всех современных устройств).
- **Интерактивность:** Hover/click-эффекты через Mapbox `feature-state` (без React re-renders!).
- **Видимость слоёв:** Запоминается в localStorage; быстрая кнопка сброса кеша при ошибке.
- **Safe Area:** Корректные отступы для iOS notch и home indicator.

### Добавление точек пользователями

Любой посетитель может предложить новую точку или розетку (вкладка «Добавить точку»):

1. Клик на карте → выбор координат.
2. Заполнение формы (тип, название, описание, флаги).
3. Заявка отправляется в таблицу `map_points_submissions` (статус: pending).
4. Администратор проверяет в `/admin/submissions`, одобряет или отклоняет.
5. Одобренная точка появляется на карте всем пользователям.

### Telegram-бот для живых геопозиций

Edge Function `telegram-location-bot` — webhook для Telegram-бота:

1. **Сбор локаций:** Бот, добавленный в чат, получает обновления локаций.
2. **Сохранение:** INSERT в `telegram_locations` с координатами, user ID, chat ID.
3. **Профиль пользователя:** Автоматически подтягивает/кэширует аватар в `telegram_profiles`.
4. **Realtime broadcast:** Supabase отправляет изменение на фронтенд.
5. **Отображение:** На карте видны только свежие точки в пределах TTL и погрешности.

**Фильтры (переменные окружения):**

- `VITE_TELEGRAM_GEO_TTL_MINUTES` (default: 60) — сколько минут показывать локацию.
- `VITE_TELEGRAM_MAX_ACCURACY_METERS` (default: 100) — максимальная погрешность GPS.
- `VITE_TELEGRAM_TRACK_TAIL_MINUTES` (default: 30) — длина недавнего трека.

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
├── components/        # Основные: EucMap (оркестратор), LayerControls, FeatureSidebar, AddPointPanel
├── hooks/             # Ключевые: useMapData (fetch), useMapbox (instance), useLayers, useTelegramRealtime
├── lib/
│   ├── supabase.ts   # Все API-вызовы, timeout+retry, нормализация
│   └── mapLayers.ts  # Определения слоёв, paint expressions, feature-state
├── utils/             # Геометрия, hash-навигация, типовые гварды, GeoJSON нормализация
├── constants/         # LAYER_IDS, SOURCE_IDS, COLORS
├── types/             # GeoJSON Features, Supabase rows, Velojol
├── data/              # almaty.json (велодорожки)
└── main.tsx, App.tsx

supabase/
├── migrations/        # DDL: таблицы, RLS, Storage, индексы
├── functions/
│   └── telegram-location-bot/index.ts  # Deno: webhook, avatar fetch, INSERT
└── schema.sql         # Full export

public/
├── sw.js              # Service Worker: cache strategy (STATIC, RUNTIME, TILES)
├── manifest.webmanifest
├── favicon.svg, icons/, splash screens
```

**Для понимания архитектуры:** см. [docs/](docs/README.md) — диаграммы, data flow, схема БД, бот, тесты и деплой.

## Как система работает (в двух словах)

### Ментальная модель

Это **read-heavy, realtime-optional** система:

1. **Статические данные** (точки, маршруты) → Supabase → Frontend кэширует агрессивно
2. **Telegram-локации** → Webhook → Edge Function → Supabase Realtime → Frontend обновляется <500ms
3. **Service Worker** → App shell работает офлайн, Mapbox-тайлы кэшируются
4. **Mapbox feature-state** → Hover/select эффекты без React re-renders

### Поток данных пользователя

```
Пользователь открывает карту
  → EucMap монтируется
  → useMapData параллельно фетчит из Supabase (points, routes, telegram, velojol)
  → useLayers добавляет GeoJSON sources + layers в Mapbox
  → useTelegramRealtime подписывается на изменения
  → Карта готова к взаимодействию

Пользователь кликает на точку
  → Mapbox click event → useMapClick слушатель
  → feature-state selected=true → подсветка в Mapbox
  → URL hash обновляется (#point-123)
  → FeatureSidebar рендерится (React)

Telegram-райдер отправляет локацию в чат
  → Telegram API → Edge Function webhook
  → Скачивается аватар, удаляется bot token, загружается в Storage
  → INSERT telegram_locations
  → Supabase Realtime broadcast
  → Frontend refreshTelegramUsers() → GeoJSON обновляется
  → Mapbox source обновляется → карта перерисовывается
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
| `VITE_TELEGRAM_TRACK_TAIL_MINUTES`  | Длина «хвоста» трека по времени.                            |
| `VITE_TELEGRAM_MAX_ACCURACY_METERS` | Максимально допустимая погрешность координат, м.            |

### Локальная разработка бэкенда (Supabase)

Для разработки и правки **логики бота, миграций и RLS** работайте с локальным стеком — это быстро, бесплатно и оффлайн, без облачных preview-веток (они требуют платного плана). Локальный стек поднимает полный Supabase в Docker: Postgres, Auth, Storage, Realtime, Studio и Edge Runtime.

```bash
supabase start        # поднять весь стек (Docker)
supabase status       # URL'ы и ключи (anon/service_role) для .env.local
supabase stop         # остановить
```

Порты заданы в [supabase/config.toml](supabase/config.toml): API `54321`, DB `54322`, Studio `54323`.

**Миграции и RLS** — правьте файлы в `supabase/migrations/`, затем пересоздайте локальную БД (применит миграции + `seed.sql`):

```bash
supabase db reset
```

> На удалённый проект миграции применяются через `supabase db push` или CI — **не** через MCP `apply_migration`, иначе история миграций разойдётся.

**Edge Function (Telegram-бот)** — запуск локально с hot-reload:

```bash
supabase functions serve telegram-location-bot
# доступна по http://127.0.0.1:54321/functions/v1/telegram-location-bot
```

Функция задекларирована в [supabase/config.toml](supabase/config.toml) секцией `[functions.telegram-location-bot]` с `verify_jwt = false` — вебхук Telegram приходит без Supabase JWT, аутентификация идёт по secret-токену внутри функции. Эта же декларация нужна, чтобы функция автоматически деплоилась в облачные branch-окружения.

Telegram-вебхуку нужен публичный HTTPS-URL, поэтому для теста реального вебхука пробросьте локальную функцию наружу туннелем (`ngrok` / `cloudflared`) либо используйте облачную preview-ветку (Pro-план).

## Админка карты

Маршрут `/admin` (на проде: `https://map.euc.kz/admin`): модерация заявок, CRUD точек и маршрутов, фото, просмотр live Telegram-трекинга.

### Аутентификация

- **Тип:** Supabase Auth (email/пароль)
- **Авторизация:** Проверка `map_admin_users` таблицы через RLS
- **Безопасность:** Service role ключ **не** попадает в браузер (Supabase блокирует). Только anon ключ.
- **Сессия:** Хранится в localStorage; refresh token управляется SDK

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
    Альтернатива: заполнить эти переменные в `.env.local` и выполнить `npm run secrets:sync` — скрипт зальёт все заполненные секреты edge-функций разом.
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

### Анонсы событий в Telegram + RSVP «Участвую»

Та же Edge Function `telegram-location-bot` обслуживает рассылку анонсов дат событий и обработку кнопки «Участвую»:

- **Сабрут `/announce`** (`POST`, авторизация по JWT администратора): отправляет анонс конкретной даты события в выбранные чаты с инлайн-кнопкой «Участвую». Вызывается из админки через `supabase.functions.invoke('telegram-location-bot/announce', …)`.
- **Сабрут `/announce-cancel`** (`POST`, JWT администратора): при отмене даты редактирует все её сообщения в «❌ ОТМЕНЕНО» и убирает кнопку.
- **`callback_query`**: нажатие «Участвую» в любом чате — toggle участия по `telegram_user_id` (повторный тап убирает запись), счётчик в подписи кнопки обновляется. Профиль участника при необходимости создаётся в `telegram_profiles` (без аватара — его добьёт backfill).

Список чатов для рассылки хранится в таблице `telegram_chats` (управляется в админке `/admin/telegram-chats`, не через env). Участники — в `map_event_participants`, отправленные сообщения — в `telegram_outbound_messages` (общая таблица для анонсов событий и новостей проекта). Новых секретов не требуется: используются существующие `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Подробно: [docs/telegram-bot.md](docs/telegram-bot.md).

## ИИ-помощник в админке (ai-assist)

Edge Function `ai-assist` улучшает название/описание точек и маршрутов через OpenAI (Responses API + web-поиск) — кнопка «Улучшить с ИИ» на страницах редактирования в админке. Авторизация — JWT администратора + `map_admin_users`. Подробно: [docs/admin.md](docs/admin.md).

Настройка:

1. Впишите `OPENAI_API_KEY` (и опционально `OPENAI_MODEL`, по умолчанию `gpt-5-mini`) в `.env.local`.
2. Залейте секреты в Supabase (скрипт заливает все заполненные секреты edge-функций из `.env.local`, включая `TELEGRAM_*`):
    ```bash
    npm run secrets:sync
    ```
3. Деплой функции — автоматически при push в `main`; вручную:
    ```bash
    supabase functions deploy ai-assist --no-verify-jwt --use-api
    ```

## Отладка

### Service Worker / PWA

```bash
# Проблема: изменения не видны после деплоя
# Решение: очистить все кэши
- DevTools → Application → Service Workers → Unregister
- Clear All (Storage)
- Hard refresh (Ctrl+Shift+R или Cmd+Shift+R)
# Или: используй кнопку "Сброс кеша" в приложении
```

### Mapbox не загружается

```javascript
// DevTools console:
map.getStyle() // Проверить стиль
map.getSources() // Список источников
map.getLayers() // Список слоёв
map.querySourceFeatures(sourceId) // Данные в источнике
```

### Supabase не подключён

- Проверить `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Протестировать в Supabase Dashboard → SQL Editor (SELECT 1 как anon)

### Telegram-локации не появляются

- Supabase Dashboard → Edge Functions → `telegram-location-bot` → Logs
- Проверить `TELEGRAM_WEBHOOK_SECRET` совпадает с Telegram API
- Ручной тест webhook (см. [docs/telegram-bot.md](docs/telegram-bot.md))

## База данных (Supabase)

| Таблица                      | Цель                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| `map_points`                 | Точки и розетки (type: point \| socket), флаги: meeting, socket, disabled |
| `map_routes`                 | Маршруты (LineString с опциональными высотами, via_coordinates)           |
| `map_points_submissions`     | Очередь модерации (status: pending \| approved \| rejected)               |
| `map_point_photos`           | Фото (FK → points), Storage bucket references                             |
| `map_admin_users`            | Администраторы (FK → auth.users), заполняется вручную                     |
| `telegram_locations`         | Живые локации (с фильтром TTL в коде)                                     |
| `telegram_profiles`          | Кэш аватаров, имён, ников Telegram-пользователей                          |
| `map_events`                 | События (покатушки/мероприятия/обучение) + фото, старт/финиш              |
| `map_event_dates`            | Даты проведения событий (с отменой)                                       |
| `map_event_participants`     | RSVP «Участвую» из Telegram (toggle)                                      |
| `map_news`                   | Новости проекта (только рассылка, мягкое удаление)                        |
| `telegram_chats`             | Чаты/темы для рассылки анонсов                                            |
| `telegram_outbound_messages` | Исходящие сообщения бота (анонсы событий ЛИБО новости)                    |

**RLS:** Публичные таблицы: чтение анонимно (где `flag_disabled = false`), запись только администраторам. Полная матрица — в [docs/database.md](docs/database.md).

## Для новых инженеров

### Первые 30 минут

1. Прочитай этот README + [docs/architecture.md](docs/architecture.md)
2. `npm install && npm run dev`
3. Открой `http://localhost:5173` в браузере
4. Кликни на точку → смотри как это работает в DevTools

### Первый час

5. Откройте DevTools → Console, Application, Network
6. Кликните на точку на карте → watch `useMapClick` trigger → `feature-state` updated → Mapbox перерисует
7. Переключите видимость слоя → watch localStorage update
8. Посмотрите код в `src/components/EucMap.tsx` (оркестратор), `src/hooks/useMapData.ts` (fetch), `src/lib/mapLayers.ts` (слои)

### Первая задача

**Низкий риск:** Добавь новый toggle для слоя (копируй существующий паттерн)  
**Средний риск:** Измени TTL или max accuracy для Telegram  
**Высокий риск:** Трогай RLS policies, paint expressions, Mapbox feature-state logic

### Опасные файлы

Не модифицируй впервые без очень хорошей причины:

- `src/lib/mapLayers.ts` — paint expression ошибки → невидимые слои
- `supabase/migrations/` — RLS ошибки → утечка данных
- `src/hooks/useMapData.ts` — race condition → stale data
- `supabase/functions/telegram-location-bot/index.ts` — утечка bot token

## Генерация PWA-ассетов

Иконки и splash-screens генерируются из `public/favicon.svg`:

```bash
npm run generate:pwa-icons
npm run generate:pwa-startup
```

## Ключевые архитектурные паттерны

### 1. Feature-State вместо React re-renders

**Что:** Mapbox `feature-state` с paint expressions для hover/select вместо DOM обновления.

```javascript
// No React re-render! Pure Mapbox update:
map.setFeatureState({ source, id }, { selected: true })
// Paint expr: ["case", ["feature-state", "selected"], selectedColor, defaultColor]
```

**Зачем:** Ultra-smooth interactions без JavaScript bottleneck. Hover на 10K точек → zero lag.

### 2. Promise.allSettled для resilience

**Что:** Если одна из 4 фетчей упадёт, карта всё равно грузится с остальными данными.

```javascript
const [pointsResult, routesResult, telegramResult, bikeLanesResult]
  = await Promise.allSettled([...])
// Даже если одна rejected, остальные fulfilled работают
```

**Зачем:** Degrade gracefully. Telegram down? Остальные слои видны.

### 3. Timeout + Retry для API-вызовов

**Что:** Каждый API-вызов обёрнут в `withTimeoutAndRetry` (10s timeout, 2 retries, экспоненциальная задержка).

**Зачем:** Надёжность на плохом интернете. На мобильных сетях часто бывают висящие запросы.

### 4. Service Worker aggressive caching

**Что:** Три кэша: STATIC (app shell), RUNTIME (pages), TILES (Mapbox tiles).

**Зачем:** Приложение работает офлайн. Тайлы кэшируются forever (immutable by URL).

### 5. Supabase Realtime только для Telegram

**Что:** Только `telegram_locations` и `telegram_profiles` на живой подписке. Остальное batch-fetch.

**Зачем:** Simpler. Eventual consistency OK для points/routes (не меняются часто).

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

| GitHub Variables                    | Значение                                                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_PROJECT_REF`              | Идентификатор проекта из URL дашборда: `https://app.supabase.com/project/<SUPABASE_PROJECT_REF>` (совпадает с поддоменом `https://<SUPABASE_PROJECT_REF>.supabase.co`). |
| `VITE_MAPBOX_TOKEN`                 | Публичный токен Mapbox (см. раздел «Переменные окружения»).                                                                                                             |
| `VITE_SUPABASE_URL`                 | URL проекта Supabase.                                                                                                                                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY`     | Anon / publishable-ключ.                                                                                                                                                |
| `VITE_YANDEX_METRIKA_ID`            | ID Яндекс.Метрики; допускается пустая строка.                                                                                                                           |
| `VITE_TELEGRAM_GEO_TTL_MINUTES`     | TTL геометок Telegram на карте.                                                                                                                                         |
| `VITE_TELEGRAM_TRACK_TAIL_MINUTES`  | Длина «хвоста» трека.                                                                                                                                                   |
| `VITE_TELEGRAM_MAX_ACCURACY_METERS` | Макс. погрешность координат, м.                                                                                                                                         |

| GitHub Secrets          | Значение                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN` | [Personal access token](https://supabase.com/dashboard/account/tokens) Supabase.                                               |
| `SUPABASE_DB_PASSWORD`  | Пароль базы данных проекта (Settings → Database).                                                                              |
| `TELEGRAM_BOT_TOKEN`    | Токен бота для уведомлений о результате деплоя в Actions (не путать с секретом Edge Function — там свой экземпляр в Supabase). |
| `TELEGRAM_CHAT_ID`      | Чат или канал для этих уведомлений.                                                                                            |

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
