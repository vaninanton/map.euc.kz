# Changelog

## [Unreleased] — 2026-08-05

### Changed

- Хостинг переехал с GitHub Pages на Cloudflare Pages (проект `map-euc`, direct upload через `wrangler` из GitHub Actions). Домен `map.euc.kz` и origin не меняются, так что PWA у пользователей переживает переезд без переустановки
- SPA-фолбэк теперь `public/_redirects` (`/* /index.html 200`) вместо копии `index.html` → `404.html`: прямой заход на `/m/point/11` и `/events/5` отдаёт 200, а не 404 с телом приложения
- `base` в Vite зафиксирован в `/`; ветка `GITHUB_PAGES` с префиксом `/map.euc/` удалена — в прод-сборку она никогда не попадала

### Added

- `public/_headers`: `immutable`-кэш для хешированных бандлов, недельный для иконок, `no-cache` для `sw.js`, обязательная ревалидация HTML
- Тесты конфигурации деплоя (`src/test/deployConfig.test.ts`) и контракта SPA-роутинга по HTTP-статусам (`tests/e2e/routing.e2e.ts`)
- Мета-тег `yandex-verification` как дубль файловой верификации — Cloudflare Pages редиректит `.html`-адреса

### Fixed

- Сервис-воркер больше не кэширует `/index.html` по прямому адресу: Cloudflare Pages отдаёт на него 308, а redirected-ответ на navigation-запрос ломал офлайн-фолбэк с `TypeError`

## [Unreleased] — 2026-07-18

### Added

- Замена фото в уже отправленных новостях: «Обновить текст во всех отправленных» синхронизирует и заменённое фото через `editMessageMedia` (только «фото → другое фото» — Telegram не конвертирует медиа-сообщение в текстовое и наоборот)

### Changed

- Подсказка про фото новости переписана честно (замена фото возможна, с ограничением Telegram) вместо неверного «Telegram не меняет картинку»
- При создании новости показывается пояснение, что сохраняется черновик и рассылка не произойдёт

## [Unreleased] — 2026-07-14

### Fixed

- Маркер геопозиции и круг точности больше не перехватывают касания: на телефоне жест, начатый на маркере, «сдвигал» его вместо панорамирования карты (`pointer-events: none` + e2e-тест)
- `isTransientError`: коды 429/5xx ищутся как отдельные числа — раньше любая ошибка с цифрой «5» в тексте (403/RLS и т.п.) зря ретраилась дважды; таймауты собственного `withTimeout` («превышено время ожидания») теперь корректно ретраятся
- Escape в лайтбоксе фото закрывает только лайтбокс: раньше то же нажатие доходило до window-обработчика сайдбара и закрывало всю карточку точки; стрелки ←/→ в лайтбоксе больше не двигают карту
- Service worker: офлайн-навигация на непосещённый URL теперь падает на app shell (`index.html` из static-кэша) вместо браузерной страницы «Нет соединения»
- Service worker не регистрируется в dev (и разрегистрируется, если остался): cache-first отдавал устаревшие `/src/*`-модули и CSS до перезапуска dev-сервера

## [Unreleased] — 2026-07-13

### Added

- Скилл `/supabase-clone-prod` — локальный Supabase-стек из миграций + данные с прода в `supabase/seed.sql` (gitignored, содержит PII)

### Changed

- `supabase/config.toml`: секция `[inbucket]` переименована в `[local_smtp]` (новое имя в актуальных версиях Supabase CLI)

## [Unreleased] — 2026-07-02 (дашборд)

### Added

- Админ-дашборд на `/admin`: райдеры за сегодня/7 дней/30 дней/год, sparkline активности за 30 дней, контент (точки, маршруты + суммарные км, события, новости), алерты (pending-заявки, ошибки рассылок за 30 дней, health-check webhook'а бота)
- RPC `get_admin_dashboard_stats` (SECURITY DEFINER, только админы) — все агрегаты одним вызовом; миграция `20260702120000`
- Бейдж числа pending-заявок в меню админки (`countPendingSubmissions`)
- Утилиты `routeDistance.ts` (км маршрутов) и `adminTime.ts` (`formatAgo`, `isBotStale`) с тестами
- `IDEAS.md` — бэклог идей развития проекта

### Changed

- `/admin` больше не редиректит на `/admin/submissions` — там дашборд

### Performance

- Ускорена загрузка дашборда: RPC `get_admin_dashboard_stats` читает 30-дневное окно `telegram_locations` одним сканом (CTE `recent AS MATERIALIZED`) вместо четырёх — 5 сканов таблицы → 2; добавлен индекс `(created_at, telegram_user_id)` (узкий Index Only Scan, сортировка `count(DISTINCT)` ушла с диска в память); миграция `20260702130000`
- `useAdminAuth`: единый источник проверки прав через `onAuthStateChange` + кэш по `user.id` — вместо дублирующегося запроса `map_admin_users` (2 → 1)

## [Unreleased] — 2026-07-02

### Added

- Полная документация проекта в `docs/`: архитектура, фронтенд, БД/RLS, Telegram-бот, события/новости, админка, тесты, деплой
- `AGENTS.md` переписан: правила и жёсткие инварианты для AI-агентов и разработчиков
- В скилл `/commit` добавлен шаг проверки актуальности документации

### Changed

- `README.md` и `CLAUDE.md` актуализированы и ссылаются на `docs/` (deep links `/m/...`, таблица БД, pre-commit)

## [Unreleased] — 2026-06-27

### Added

- Новости проекта: раздел `/admin/news` — создание новости (текст + фото), рассылка в выбранные Telegram-чаты, обновление текста во всех отправленных сообщениях и удаление их из Telegram
- Edge-сабруты `telegram-location-bot`: `/news-announce`, `/news-announce-edit`, `/news-announce-delete`
- Миграция: таблица `map_news`, Storage-бакет `map-news-photos`

### Changed

- Исходящие сообщения бота объединены в единую таблицу `telegram_outbound_messages` (переименование `map_event_announcements` + полиморфная привязка `event_date_id` | `news_id`); анонсы событий и новости используют общие helpers (`announceClient`, `listLiveAnnouncements`, `editAnnouncementContent`)

## [Unreleased] — 2026-06-22

### Fixed

- Восстановлены типы для mapbox-gl: добавлены devDependencies `@types/geojson` (namespace `GeoJSON`) и `@mapbox/point-geometry` (тип `Point`) — без них `npm run build` падал с 13 ошибками типов

## [Unreleased] — 2026-06-16

### Added

- PhotoManager: drag & drop загрузка фото в зону
- PhotoManager: вставка фото из буфера обмена (Ctrl+V)
- PhotoManager: лайтбокс — полноэкранный просмотр по клику, навигация стрелками/клавишами, закрытие по Escape/×
- PhotoManager перенесён в левую колонку формы рядом с картой
- PointsPage: колонка «Фото» с числом фотографий у каждой точки
- 16 unit-тестов для PhotoManager, 3 теста для parsers (photo_count)
