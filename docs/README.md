# Документация map.euc.kz

PWA-карта для райдеров на моноколёсах (EUC) в Алматы — live at **map.euc.kz**.
Точки встреч, розетки, маршруты, велодорожки, live-геопозиции из Telegram-чатов, события и новости сообщества.

Эта директория — канонический источник документации проекта. Актуальность: **2026-07-02**.
При изменении поведения, схемы БД или маршрутов — обновляйте соответствующий файл здесь.

## Карта документации

| Файл                               | Содержание                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md) | Общая архитектура: топология, потоки данных, ключевые паттерны, структура репозитория         |
| [frontend.md](frontend.md)         | SPA: маршруты, компоненты, хуки, константы, `lib/`, `utils/`, PWA/Service Worker, аналитика   |
| [database.md](database.md)         | Supabase: все таблицы, RLS-политики, enums, RPC, Storage-бакеты, правила работы с миграциями  |
| [telegram-bot.md](telegram-bot.md) | Edge Function `telegram-location-bot`: webhook, inline-режим, RSVP, анонсы, backfill, секреты |
| [events-news.md](events-news.md)   | Подсистема событий и новостей: публичный UI, админка, рассылка анонсов в Telegram             |
| [admin.md](admin.md)               | Админка `/admin`: аутентификация, маршруты, adminApi, редактор маршрутов, компоненты          |
| [testing.md](testing.md)           | Тестирование: Vitest, Playwright (моки), Deno-тесты edge-функции, pre-commit                  |
| [deployment.md](deployment.md)     | CI/CD: deploy/test/backup workflows, переменные и секреты, локальный Supabase, GitHub Pages   |

## Правила разработки

- **[../AGENTS.md](../AGENTS.md)** — правила для AI-агентов и разработчиков: стиль кода, инварианты, чек-листы, запреты.
- **[../CLAUDE.md](../CLAUDE.md)** — инструкции для Claude Code (согласованы с AGENTS.md).

## Быстрый старт

```bash
npm install
cp .env.example .env.local   # заполнить VITE_MAPBOX_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # localhost:5173
```

Полный список команд и переменных окружения — в [deployment.md](deployment.md), пользовательский обзор — в [../README.md](../README.md).
