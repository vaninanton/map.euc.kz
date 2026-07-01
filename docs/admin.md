# Админка (`/admin`)

Lazy-loaded раздел SPA. Доступ: Supabase Auth (email/пароль) + запись в `map_admin_users`. Яндекс.Метрика в `/admin/*` отключена полностью (`isAdminPath`).

## Каркас

- `AdminShell.tsx` — `<AdminAuthGate><AdminLayout/></AdminAuthGate>`;
- `AdminAuthGate.tsx` — состояния `loading → misconfigured | unauthenticated (логин-форма) | forbidden | ready`;
- `AdminLayout.tsx` — боковое меню + `Outlet` в `Suspense`;
- `lazyAdminPages.ts` — `React.lazy()` для всех страниц.

`useAdminAuth` слушает `onAuthStateChange` и проверяет `SELECT user_id FROM map_admin_users WHERE user_id = auth.uid()`. Сессия — в localStorage (SDK), service-role ключ в браузер не попадает.

## Маршруты

| Путь                           | Страница                      | Назначение                                                                                                                            |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                       | `DashboardPage`               | Дашборд: райдеры за периоды, sparkline за 30 дней, контент (+км маршрутов), алерты (pending, ошибки рассылок, health-check webhook'а) |
| `/admin/submissions`           | `SubmissionsPage`             | Модерация заявок (фильтр по статусу, approve → создаёт точку, reject)                                                                 |
| `/admin/point`, `/new`, `/:id` | `PointsPage`, `PointEditPage` | CRUD точек: карта + форма + `PhotoManager`; toggle disabled                                                                           |
| `/admin/route`, `/new`, `/:id` | `RoutesPage`, `RouteEditPage` | CRUD маршрутов: полилиния + список вершин + высоты                                                                                    |
| `/admin/event`, `/new`, `/:id` | `EventsPage`, `EventEditPage` | События + даты + анонсы (см. [events-news.md](events-news.md))                                                                        |
| `/admin/news`, `/new`, `/:id`  | `NewsPage`, `NewsEditPage`    | Новости + рассылка                                                                                                                    |
| `/admin/telegram-chats`        | `TelegramChatsPage`           | Чаты/темы для рассылки (enabled, sort_order, thread)                                                                                  |
| `/admin/geo`                   | `GeoPage`                     | Треки райдеров за период (30 мин…всё), `AdminGeoMap`                                                                                  |

Кнопка «Открыть на сайте» в edit-страницах: `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(...)}`.

### Дашборд

- Данные — одним вызовом RPC `get_admin_dashboard_stats()` (см. [database.md](database.md)); километраж маршрутов считается на клиенте из `listRoutes()` (`src/admin/utils/routeDistance.ts`), best-effort.
- Границы периодов «сегодня/7 дней/30 дней/год» — по полуночи Алматы (Asia/Almaty), считаются в RPC.
- Health-check бота: `isBotStale()` (`src/admin/utils/adminTime.ts`) — алерт, если последней геопозиции больше 48 часов.
- В боковом меню (`AdminLayout`) — бейдж числа pending-заявок (`countPendingSubmissions()`), обновляется при переходах между разделами.

## adminApi (`src/admin/lib/adminApi/`)

Инфраструктура:

- `query.ts` — `db()` (клиент с сессией пользователя, RLS), `runOneRaw/runManyRaw/runOneParsed/runManyParsed` (label для ошибок + runtime-валидация);
- `parsers.ts` — runtime-валидаторы всех моделей (`parseAdminMapPoint`, `parseAdminEvent`, …);
- `types.ts` — `AdminMapPoint`, `AdminMapRoute`, `AdminSubmission`, `AdminEvent(+Date,+Participant,+Announcement)`, `AdminNews(+Announcement)`, `AdminTelegramChat`, Input/Patch-типы;
- `constants.ts` — имена бакетов (`PHOTOS_BUCKET`, `EVENT_PHOTOS_BUCKET`, `NEWS_PHOTOS_BUCKET`);
- `announceClient.ts` — `invokeAnnounce(subroute, body)` → `functions.invoke('telegram-location-bot/<subroute>')` с JWT сессии.

Домены:

| Модуль                  | Функции                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `points.ts`             | `listPoints/getPoint/createPoint/updatePoint/togglePointDisabled/deletePoint` (с чисткой фото)                                                                                       |
| `routes.ts`             | аналогичный CRUD маршрутов                                                                                                                                                           |
| `submissions.ts`        | `listSubmissions(status?)`, `approveSubmission` (создаёт `map_points`), `rejectSubmission`, `countPendingSubmissions`                                                                |
| `photos.ts`             | `listPhotos/uploadPhoto/updatePhoto/deletePhoto` (Storage + БД с откатом при ошибке)                                                                                                 |
| `events.ts`             | CRUD событий, дат (`listEventDates/addEventDate/updateEventDate/deleteEventDate`), фото                                                                                              |
| `eventAnnouncements.ts` | `announceEventDate/editEventDateAnnouncements/cancelEventDateAnnouncements/deleteEventDateAnnouncements/pinEventAnnouncement/listEventParticipants/listEventAnnouncements(ForDates)` |
| `news.ts`               | CRUD новостей (soft delete), фото                                                                                                                                                    |
| `newsAnnouncements.ts`  | `announceNews/editNewsAnnouncements/deleteNewsAnnouncements/listNewsAnnouncements`                                                                                                   |
| `telegramChats.ts`      | CRUD назначений рассылки                                                                                                                                                             |
| `dashboard.ts`          | `getDashboardStats` — RPC `get_admin_dashboard_stats` (агрегаты дашборда)                                                                                                            |
| `geo.ts`                | `fetchTelegramLocations(periodMinutes)` (пагинация по 1000), `buildRiderTracks` (группировка по райдеру, 10 цветов)                                                                  |

## Редактор маршрутов (`src/admin/route-editor/`)

- `routeGeometry.ts` — тип `RouteEditorCoordinates` (`[lng, lat]` | `[lng, lat, z]`), проекция точки на сегмент (`closestOnSegment2D`), вставка/удаление/перемещение вершин, конвертация в LineString/FeatureCollection;
- `routeValidation.ts` — название 4–99 символов, минимум 2 вершины.

`RouteEditPage` объединяет: `AdminRoutePolylineMap` (drag вершин, click-to-insert, hover-подсветка) + `RouteVertexEditorList` (таблица вершин, упрощение `simplifyRouteCollinear`, заполнение высот `fetchMissingRouteElevations`) + undo/redo.

## Undo/Redo координат

- `useCoordinateHistory` — стеки undo/redo (JSON-сериализация), `prepareCommit/undo/redo/reset`;
- `useUndoRedoHotkeys` — глобальные Ctrl/Cmd+Z и Ctrl/Cmd+Shift+Z, игнорирует фокус в input/textarea/contenteditable.

## Компоненты (`src/admin/components/`)

| Компонент                                                                                               | Роль                                                                 |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `PointForm`                                                                                             | Форма точки (тип, флаги, координаты с парсингом строки, undo)        |
| `PhotoManager`                                                                                          | Фото точки: drag&drop, Ctrl+V, сортировка, lightbox (16 unit-тестов) |
| `AdminPointLocationMap`                                                                                 | Мини-карта с перетаскиваемым маркером точки                          |
| `AdminRoutePolylineMap`                                                                                 | Интерактивная полилиния маршрута                                     |
| `AdminGeoMap`                                                                                           | Треки райдеров; разрыв сегмента при > 1 км или > 5 мин               |
| `RouteVertexEditorList`                                                                                 | Таблица вершин с автопрокруткой к подсвеченной                       |
| `ConfirmDialog`                                                                                         | Подтверждение (danger/обычный)                                       |
| `EventForm`, `EventDatesManager`, `EventPhotoManager`, `EventAnnounceModal`, `AnnouncementMessagesList` | События                                                              |
| `NewsPhotoManager`, `NewsAnnounceManager`, `NewsMessagesList`                                           | Новости                                                              |

`useAdminListLoader<T>` — универсальная загрузка списков (items/loading/error/reload) для всех list-страниц.

## Первичная настройка администратора

1. Supabase → Authentication → включить Email-провайдер, создать пользователя.
2. `INSERT INTO public.map_admin_users (user_id) VALUES ('<uuid>') ON CONFLICT DO NOTHING;`
3. Войти на `/admin`.
