# Фронтенд (SPA)

React 19 + TypeScript (strict) + Vite 8 + Tailwind CSS 4 + Mapbox GL JS 3 + react-router-dom 7.

## Маршруты

Точка входа: `src/main.tsx` (регистрация Service Worker → `createRoot`) → `src/App.tsx`
(`<BrowserRouter basename={import.meta.env.BASE_URL}>`).

| Путь               | Что открывается                                                                 |
| ------------------ | ------------------------------------------------------------------------------- |
| `/`                | Карта (`MapShell` → lazy `EucMap`)                                              |
| `/m/:type/:id`     | Deep-link на фичу карты: `point`, `route`, `socket`, `bikelane`, `telegramuser` |
| `/events`          | Лента событий поверх карты (`EventsScreen`)                                     |
| `/events/:eventId` | Детали события (`EventDetailScreen`) — **не** `/m/event/...`!                   |
| `/radar`           | Радар live-райдеров (`RadarModal`)                                              |
| `/help`            | Справка о проекте (`ProjectInfoModal`)                                          |
| `/admin/*`         | Lazy-loaded админка (см. [admin.md](admin.md))                                  |
| `*`                | `NotFound` → редирект на `/`                                                    |

Все «экранные» маршруты (`/events`, `/radar`, `/help`, `/m/...`) рендерят один и тот же `MapShell`/`EucMap` — экраны накладываются поверх живой карты. Глобально вне `Routes`: `YandexMetrika`, `PwaPrompts`; `MapShell` обёрнут в `Suspense` + `AppErrorBoundary`.

### Deep links и легаси-hash

- `buildMapDeepLinkPath(type, id)` / `parseMapDeepLinkPathname()` — `src/utils/hashNav.ts`. Тип ограничен union `HashFeatureType`.
- Событие — **отдельный** маршрут: `buildEventDetailPath(id)` из `src/utils/eventLinks.ts` (`event` не входит в `HashFeatureType`; `/m/event/5` откроет пустую карту).
- Старый формат `#point=11` автоматически редиректится на путь (`useMapSelectionSync`, `replaceState`).
- При построении абсолютных ссылок обязательно `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(...)}` — в prod `base = /map.euc/`.
- Новая сущность со своей страницей ⇒ парный `build*Path`/`parse*Pathname` + маршрут в `App.tsx`; не переиспользовать `/m/...` вслепую.

## EucMap — оркестратор

`src/components/EucMap.tsx` композирует хуки в порядке зависимостей:

1. `useMapbox(containerRef)` — единственный Mapbox-инстанс; стиль streets/satellite (persist в localStorage); `flyTo`/`flyToBounds` с синхронным `setPadding` (обход бага Mapbox 3.x «undefined reading paint»).
2. `useLayers` = `useMapData` (загрузка) + `useLayerVisibilityStore` (видимость, localStorage `map-euc-layer-visibility`).
3. `useTelegramAvatars` — грузит аватарки как канвас-иконки Mapbox (`tg-avatar-<userId>`, круглые, 48px@2x).
4. `useEvents` — события + счётчик непрочитанных.
5. `useMapFeatureSelection` / `useSelectedFeatureState` — выбор фичи, feature-state, фокус камеры.
6. `useDraftPointFlow` — режим добавления точки.
7. `useMapClick` (touch hit-padding 12px для линий), `useMapHover` (RAF-троттлинг, тултипы, «N мин назад» для stale-райдеров).
8. `useMapSelectionSync` — URL ↔ выбранная фича (+ миграция легаси-hash).
9. `useMapPadding` — отступы карты под сайдбары (desktop: 320/360 px, mobile: 45vh/80vh).
10. `useGeolocateControl` — стандартный `mapboxgl.GeolocateControl` + цели аналитики.

Рендерит: `LiveActivityBar`, `MapNotificationModals`, `LayerControls`, `BottomTabBar`, `AddPointPanel`, `MapFeatureInfoModal`, `RouteListSidebar`, `PointListSidebar`, `ProjectInfoModal`, `EventsScreen`, `EventDetailScreen`, `RadarModal`.

## Инвентарь хуков (`src/hooks/`)

| Хук                           | Назначение                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `useMapbox`                   | Жизненный цикл Mapbox-инстанса, переключение стилей, flyTo/flyToBounds                                  |
| `useMapData`                  | Параллельная загрузка всех GeoJSON-слоёв; двухфазный Telegram (latest → полные треки); realtime-refresh |
| `useLayers`                   | Фасад: addLayersToMap / applyVisibility / toggleLayer                                                   |
| `useLayerVisibilityStore`     | Видимость слоёв, persist в localStorage                                                                 |
| `useTelegramRealtime`         | Подписка postgres_changes → debounce 300 мс → refresh                                                   |
| `useMapClick` / `useMapHover` | Клик/ховер: queryRenderedFeatures, feature-state, курсор, тултип                                        |
| `useMapSelectionSync`         | URL-путь ↔ выбранная фича; миграция `#point=11` → `/m/point/11`                                         |
| `useMapFeatureSelection`      | openFeature/clearSelection, фокус камеры, актуализация Telegram-фич из индекса                          |
| `useSelectedFeatureState`     | Проставляет/чистит feature-state `selected`, переживает `style.load`                                    |
| `useMapPopup`                 | Mapbox-popup с React-контентом через `createRoot` (unmount при закрытии)                                |
| `useMapPadding`               | setPadding под открытые панели                                                                          |
| `useFeatureIndexes`           | Map-индексы id → Feature (для points двойной ключ `point:`/`socket:`)                                   |
| `useDraftPointFlow`           | Добавление точки: координаты, submit в `map_points_submissions`, ошибки/успех                           |
| `useGeolocateControl`         | Геолокация-контрол + цели `geolocation_success`/`geolocation_denied`                                    |
| `useUserGeolocation`          | watchPosition без Mapbox (для радара)                                                                   |
| `useDeviceCompassHeading`     | Компас устройства (iOS `requestPermission`), включается лениво                                          |
| `useTelegramAvatars`          | Аватарки → именованные иконки Mapbox                                                                    |
| `useCopyShare`                | Копирование ссылки + toast 2.5 с + цель `share_app_link`                                                |
| `useEvents`                   | fetchEvents + unreadCount + markAsRead (localStorage)                                                   |
| `useMetrikaPageViews`         | SPA-pageview при смене пути; пропускает первый рендер и `/admin/*`                                      |

## Константы (`src/constants/`)

- `index.ts` — единственный источник истины: `MAP_CENTER` (`[76.904848, 43.226807]`), `MAP_ZOOM_DEFAULT` (12), `MAP_ZOOM_FOCUS` (15), `MAPBOX_STYLES` (streets — кастомный стиль, satellite), `LAYER_IDS` (7 слоёв с префиксом `euc-`), `SOURCE_IDS` (5 источников), `CLICKABLE_LAYER_IDS`, `LAYER_ID_TO_KEY`, `LAYER_ID_TO_SOURCE`, `COLORS` (point `#2563eb`, socket `#eab308`, route `#f25824`, telegramUser `#8b5cf6`, erlan `#a855f7`…), `UI_ACCENT`, русские подписи `FEATURE_TYPE_LABELS` / `POINT_FLAG_LABELS` / `EVENT_TYPE_LABELS`, тип `LayerKey`.
- `mapLayerRegistry.ts` — `LAYER_KEY_TO_MAP_LAYER_IDS` (один LayerKey может управлять несколькими слоями Mapbox, напр. telegramUsers → users + tracks), `applyVisibilityToMapLayers()`.
- `layerVisibility.ts` — интерфейс `LayerVisibility` и дефолты.

## `src/lib/`

- `env.ts` — чтение и нормализация Vite-переменных: `getViteSupabaseConfig()`, `getTelegramGeoTtlMinutes()` (60), `getTelegramMaxAccuracyMeters()` (100), `getTelegramTrackTailMinutes()` (30).
- `supabase.ts` — клиент (anon-ключ), `withTimeoutAndRetry` (10 с, 2 ретрая, backoff 250/500 мс, только transient-ошибки), `fetchMapPoints/fetchMapRoutes/fetchTelegramLocations/fetchEvents`, `createMapPointDraft`, нормализация строк в типы `types/supabase.ts`, санитизация avatar_url.
- `mapLayers.ts` — `addLayersToMap()` (порядок: routes → bikeLanes → tg-tracks → tg-users → points → sockets), paint-выражения с feature-state, SVG-иконка розетки (`ensurePlugImage`).
- `analytics.ts` — вся Метрика централизована здесь: `trackGoal(goal, params?)`, `trackPageView(url)` (no-op без счётчика, глушат ошибки), закрытый union `MetrikaGoal` (`feature_open`, `share_app_link`, `share_external_map`, `share_telegram`, `pwa_install`, `pwa_launch_standalone`, `geolocation_success`, `geolocation_denied`), `isAdminPath()` (в `/admin/*` Метрика отключена полностью), `isStandaloneLaunch()`.

## `src/utils/` (чистые функции, все с тестами)

| Группа        | Файлы                                                                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Геоматематика | `geoMath.ts` (haversineKm, bearingDegrees, шкалы радара), `bounds.ts` (bbox/центр фичи)                                                                                                                                                               |
| GeoJSON       | `supabaseToGeojson.ts` (rows → FeatureCollection, включая телеграм-треки), `mapFeatureGuards.ts` (гварды)                                                                                                                                             |
| Маршруты      | `routeStats.ts` (дистанция/набор/уклоны), `routeFilters.ts`, `routeVertexElevationStats.ts`, `fetchMissingRouteElevations.ts`, `simplifyRouteCollinear.ts`                                                                                            |
| Навигация     | `hashNav.ts` (deep links + легаси-hash), `eventLinks.ts` (`/events/:id`)                                                                                                                                                                              |
| Шаринг        | `shareLinks.ts` (Яндекс, 2ГИС, Guru, ORS, Telegram, ссылка приложения, copyToClipboard)                                                                                                                                                               |
| События       | `eventSchedule.ts` (occurrences, «Сегодня в 19:00», summarizeEvent), `eventsForPoint.ts`, `eventsReadStore.ts` (бейдж непрочитанных, localStorage `map-euc-events-last-read`), `eventAnnounce.ts` (превью анонса)                                     |
| Новости       | `newsAnnounce.ts` (живые сообщения, свободные чаты, превью заголовка)                                                                                                                                                                                 |
| Telegram      | `telegramRiders.ts` (`getActiveRiders` — TTL-фильтр активных)                                                                                                                                                                                         |
| Прочее        | `pointFilters.ts`, `selectionOpacity.ts`, `mapPopup.ts`, `numberParsers.ts`, `platformShortcuts.ts`, `resetAppCache.ts` (localStorage + Cache API + SW unregister + reload), `typograf.ts` (русская типографика, применяется через `applyTypography`) |

## Ключевые компоненты (`src/components/`)

| Компонент                                                                                   | Роль                                                                                         |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `LayerControls` / `LayerPanel`                                                              | Переключение слоёв и подложки streets/satellite                                              |
| `BottomTabBar`                                                                              | Нижняя навигация: добавить точку, радар, события (бейдж непрочитанных), справка, списки      |
| `MapFeatureInfoModal` / `FeatureSidebar`                                                    | Детали выбранной фичи: фото, статистика маршрута, ShareBlock, события точки                  |
| `PointListSidebar` / `RouteListSidebar` / `ListSidebarShell`                                | Списки с фильтрами, клик → выбор фичи на карте                                               |
| `AddPointPanel`                                                                             | Форма заявки на точку/розетку → `map_points_submissions`                                     |
| `LiveActivityBar`                                                                           | «Катают: N» — активные райдеры; клик: 1 райдер → сайдбар, рядом → fitBounds, иначе → радар   |
| `RadarModal`                                                                                | Полярный канвас-радар 320×320 (кольца 1/3/10 км): дистанция, азимут, ближайшая точка встречи |
| `EventsScreen` / `EventDetailScreen` / `EventCard` / `PointEventsBlock` / `EventShareBlock` | События (см. events-news.md)                                                                 |
| `ShareBlock` / `CopyButton` / `ShareIconButton`                                             | Кнопки шаринга (приложение, внешние карты, Telegram)                                         |
| `MapNotificationModals`                                                                     | Ошибки загрузки/геолокации, спиннер, успех заявки, кнопка сброса кеша                        |
| `PwaPrompts`                                                                                | Установка PWA: Android `beforeinstallprompt`, iOS-инструкция                                 |
| `PopupContent`                                                                              | React-контент Mapbox-попапа                                                                  |
| `AppErrorBoundary`                                                                          | Глобальный error boundary с кнопкой сброса кеша                                              |
| `YandexMetrika`                                                                             | Инициализация Метрики + `useMetrikaPageViews`; не рендерится в `/admin/*`                    |

## PWA / Service Worker

`public/sw.js`, версия кеша `map-euc-${__APP_VERSION__}` (`GITHUB_SHA` при сборке):

- **static** — app shell + `assets/`, `icons/`, `.css/.js/.svg/.png` — cache-first;
- **runtime** — навигационные запросы — network-first с fallback на главную, лимит 120 записей;
- **tiles** — тайлы/спрайты Mapbox — cache-first, лимит 500 записей;
- Supabase API (`/rest`, `/realtime`, `/auth`, `/storage`) — **не** кешируется;
- телеметрия Mapbox блокируется в `transformRequest` (`events.mapbox.com` → пустой ответ);
- устаревшие версии кешей чистятся при активации новой SW.

Регистрация: `sw.js?v=${__APP_VERSION__}` в `main.tsx`. Manifest: fullscreen/standalone, `start_url: /?homescreen=1`, тема `#0f172a`. Иконки/сплэши: `npm run generate:pwa-icons` / `generate:pwa-startup`.

Цель `pwa_launch_standalone` — единственный сигнал установленной PWA на iOS (`appinstalled` там не срабатывает).
