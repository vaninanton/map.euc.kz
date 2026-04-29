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
- **Гео из чатов (Telegram)** — актуальные геопозиции участников из подключённых Telegram-чатов и их недавние треки.

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
│                    #        useHashSelectionSync, useSelectedFeatureState, useYandexMetrika
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
| `VITE_TELEGRAM_TRACK_TAIL_MINUTES`  | Длина «хвоста» трека по времени.                            |
| `VITE_TELEGRAM_MAX_ACCURACY_METERS` | Максимально допустимая погрешность координат, м.            |

## Telegram-бот для сбора геопозиций

Реализован через Edge Function `telegram-location-bot`. Он принимает `update` от Telegram и сохраняет сообщения с `location` в таблицу `telegram_locations`.

Развёртывание:

1. Задайте секреты для функции:
    ```bash
    supabase secrets set TELEGRAM_BOT_TOKEN=<bot_token> TELEGRAM_WEBHOOK_SECRET=<random_secret>
    ```
2. Задеплойте функцию:
    ```bash
    supabase functions deploy telegram-location-bot --no-verify-jwt
    ```
3. Подключите webhook у бота:
    ```bash
    curl -X POST "https://api.telegram.org/bot<bot_token>/setWebhook" \
      -H "Content-Type: application/json" \
      -d '{"url":"https://<project-ref>.supabase.co/functions/v1/telegram-location-bot/<bot_token>","secret_token":"<random_secret>"}'
    ```

После этого любые сообщения с геопозицией в чате, где есть бот, будут попадать в `telegram_locations` и автоматически отображаться на карте.

## База данных (Supabase)

Основные таблицы:

- `map_points` — точки и розетки (тип `point_types`: `point` / `socket`), флаги «место встречи», «есть розетка», «скрыта».
- `map_routes` — маршруты как `LineString` в массиве координат.
- `map_points_submissions` — заявки на добавление точек от пользователей (модерация).
- `map_point_photos` — фотографии точек, файлы лежат в Storage-бакете.
- `telegram_locations` — сырые геопозиции, полученные от бота.
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
