# Архитектура

## Обзор

**map.euc.kz** — одностраничное PWA-приложение (React 19 + Mapbox GL JS 3) со статическим хостингом на GitHub Pages и бэкендом на Supabase (PostgreSQL + RLS + Realtime + Storage + Deno Edge Functions). Система read-heavy: почти все данные читаются анонимно через RLS-защищённый anon-ключ; запись возможна только администраторам (Supabase Auth + таблица `map_admin_users`) и Edge Function (service role).

```
┌───────────────────────────────────────────────────────────────┐
│ Браузер (SPA, GitHub Pages, map.euc.kz)                       │
│ React 19 + Mapbox GL JS 3 + Tailwind 4 + Service Worker (PWA) │
│  ├── EucMap — оркестратор карты (20+ хуков)                   │
│  ├── /events, /radar, /help — экраны поверх карты             │
│  └── /admin — lazy-loaded админка (Supabase Auth)             │
└───────────────┬───────────────────────────────────────────────┘
                │ HTTPS (REST + Realtime WebSocket + Storage)
        ┌───────▼─────────────────────────────┐
        │ Supabase                            │
        │  PostgreSQL (13 таблиц + RLS + RPC) │
        │  Storage (4 бакета фото/аватаров)   │
        │  Edge Function telegram-location-bot│
        └───────┬─────────────────────────────┘
                │ Bot API (webhook + отправка сообщений)
        ┌───────▼──────────┐
        │ Telegram         │  геопозиции, inline-поиск, анонсы, RSVP
        └──────────────────┘
```

## Домены системы

1. **Карта** — точки (`map_points`), маршруты (`map_routes`), велодорожки (статический датасет Velojol `src/data/almaty.json`), live-геопозиции Telegram. Подробно: [frontend.md](frontend.md).
2. **Пользовательские заявки** — анонимная форма «Добавить точку» → `map_points_submissions` → модерация в админке.
3. **События** — `map_events` + даты (`map_event_dates`) + участники RSVP (`map_event_participants`), публичная лента `/events`. Подробно: [events-news.md](events-news.md).
4. **Новости** — `map_news`, только админка + рассылка в Telegram.
5. **Telegram-бот** — приём live-геопозиций, inline-поиск точек/маршрутов, рассылка/правка/удаление анонсов, кнопка «Участвую». Подробно: [telegram-bot.md](telegram-bot.md).
6. **Админка** — `/admin`, CRUD всего вышеперечисленного. Подробно: [admin.md](admin.md).

## Поток данных карты

```
useMapData.ts
  ├─ fetchMapPoints()      → mapPointsToFeatureCollection()    → pointsGeo
  ├─ fetchMapRoutes()      → mapRoutesToFeatureCollection()    → routesGeo
  ├─ velojolToFeatureCollection(almaty.json)                   → bikeLanesGeo
  └─ fetchTelegramLocations()  (RPC get_latest_telegram_locations)
       ├─ telegramLocationsToUsersFeatureCollection()          → telegramUsersGeo
       └─ telegramLocationsToRecentTracksFeatureCollection()   → telegramTracksGeo

Все запросы — через Promise.allSettled (один упавший не блокирует остальные).
Каждый запрос обёрнут withTimeoutAndRetry(): таймаут 10 с, 2 повтора, экспоненциальный backoff.

useLayers.ts → lib/mapLayers.ts → GeoJSON sources + paint layers в Mapbox

Realtime: useTelegramRealtime.ts → postgres_changes (telegram_locations, telegram_profiles)
  → debounce 300 мс → refreshTelegramUsers() → source.setData()  (обновление на карте < 500 мс)
```

## Ключевые архитектурные паттерны

### 1. Feature-state вместо React-ререндеров

Hover/select на карте реализованы через Mapbox `feature-state` и paint-выражения — ноль React-ререндеров:

```js
map.setFeatureState({ source, id }, { selected: true })
// paint: ["case", ["feature-state", "selected"], selectedColor, defaultColor]
```

Затемнение невыбранных фич — `utils/selectionOpacity.ts`.

### 2. Устойчивость к сбоям

- `Promise.allSettled` — карта грузится, даже если один из источников упал.
- `withTimeoutAndRetry` в `lib/supabase.ts` — ретраи только на transient-ошибках (timeout, network, 429, 5xx).
- Отсутствие Supabase-конфигурации не роняет приложение: предупреждение в консоль, карта без данных.

### 3. Один источник истины для констант

Все строковые ID слоёв/источников, цвета и подписи — только в `src/constants/index.ts` (`LAYER_IDS`, `SOURCE_IDS`, `COLORS`, `FEATURE_TYPE_LABELS`…). Дублирование строк в коде запрещено.

### 4. Разделение слоёв кода

```
components/  UI, без бизнес-логики
hooks/       состояние, эффекты, загрузка данных
lib/         клиенты и конфигурация (supabase, mapLayers, env, analytics)
utils/       чистые функции без React/Mapbox — все покрыты тестами
constants/   ID, цвета, подписи
types/       общие типы (GeoJSON, Supabase rows, Velojol)
admin/       изолированная lazy-loaded админка со своим API-слоем (adminApi)
```

### 5. Realtime только там, где нужно

Live-подписка — только на `telegram_locations`/`telegram_profiles`. Точки, маршруты и события — batch-fetch при загрузке (меняются редко, eventual consistency достаточно).

### 6. Безопасность

- В браузер попадает только publishable (anon) ключ; все ограничения — на RLS.
- Service-role ключ живёт только в Edge Function.
- Bot-токен Telegram никогда не попадает в БД/Storage/браузер: URL аватаров санируются (`/file/bot<TOKEN>/` вырезается, файл кэшируется в Storage).

## Структура репозитория

```
src/                  фронтенд (см. frontend.md, admin.md)
supabase/
├── migrations/       26 SQL-миграций — единственный способ менять схему
├── functions/telegram-location-bot/   Deno edge-функция (index, _handlers, _pure + тесты)
├── schema.sql        полный экспорт схемы (справочный)
└── config.toml       локальный стек + декларация функции (verify_jwt = false)
public/               PWA: sw.js, manifest, иконки/сплэши
tests/e2e/            Playwright-тесты с полными моками Mapbox/Supabase
docs/                 эта документация
.github/workflows/    deploy.yml, test.yml, backup.yml (см. deployment.md)
```

## Деплой в двух словах

Push в `main` → GitHub Actions: `supabase db push` + деплой edge-функции → сборка Vite (`base=/map.euc/`) → GitHub Pages → уведомление в Telegram. Ежедневный бэкап БД и Storage в Selectel S3. Подробно: [deployment.md](deployment.md).
