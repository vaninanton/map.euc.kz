# Changelog

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
