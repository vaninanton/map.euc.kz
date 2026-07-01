# Telegram-бот (Edge Function `telegram-location-bot`)

Deno-функция `supabase/functions/telegram-location-bot/` — единая точка интеграции с Telegram: приём геопозиций, inline-поиск, RSVP, рассылка анонсов событий и новостей.

## Файлы

- `index.ts` — маршрутизация и точка входа;
- `_handlers.ts` — обработчики с I/O (Supabase + Telegram Bot API);
- `_pure.ts` — чистые функции без I/O (построение текстов, санитизация, валидация) — покрыты unit-тестами;
- `_handlers.test.ts`, `_pure.test.ts` — `npm run test:functions` (deno test).

Задекларирована в `supabase/config.toml` с `verify_jwt = false`: webhook Telegram приходит без Supabase JWT, аутентификация — внутри функции.

## Секреты (supabase secrets set)

| Секрет                                      | Назначение                                                     |
| ------------------------------------------- | -------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Запись в БД (выдаются платформой автоматически)                |
| `TELEGRAM_BOT_TOKEN`                        | Вызовы Bot API (отправка, аватары, callback-ответы)            |
| `TELEGRAM_WEBHOOK_SECRET`                   | Проверка заголовка `x-telegram-bot-api-secret-token` webhook'а |
| `TELEGRAM_BACKFILL_SECRET`                  | Авторизация `POST /backfill`                                   |
| `TELEGRAM_BACKFILL_MAX_PROFILES`            | Лимит профилей за один backfill (default 500)                  |
| `MAP_BASE_URL`                              | База ссылок в анонсах (default `https://map.euc.kz`)           |

## Карта маршрутов

| Маршрут                      | Аутентификация               | Назначение                                             |
| ---------------------------- | ---------------------------- | ------------------------------------------------------ |
| `POST /` (webhook)           | secret-token заголовок       | update от Telegram: локации, inline, callback, команды |
| `POST /backfill`             | `x-telegram-backfill-secret` | Переобновление аватаров профилей                       |
| `POST /announce`             | JWT администратора           | Рассылка анонса даты события                           |
| `POST /announce-edit`        | JWT администратора           | Правка текста всех живых анонсов даты                  |
| `POST /announce-cancel`      | JWT администратора           | «❌ ОТМЕНЕНО» во всех живых анонсах даты               |
| `POST /announce-delete`      | JWT администратора           | Удаление сообщений анонса из Telegram                  |
| `POST /announce-pin`         | JWT администратора           | Закрепить/открепить одно сообщение                     |
| `POST /news-announce`        | JWT администратора           | Рассылка новости                                       |
| `POST /news-announce-edit`   | JWT администратора           | Синхронизация текста новости (body из `map_news`)      |
| `POST /news-announce-delete` | JWT администратора           | Удаление сообщений новости из Telegram                 |

JWT администратора проверяется по наличию в `map_admin_users`; из фронтенда сабруты вызываются через `supabase.functions.invoke('telegram-location-bot/<subroute>', …)` (`src/admin/lib/adminApi/announceClient.ts`).

## Webhook: что обрабатывает

1. **Live-геопозиции** — `message.location` с `live_period > 0` (одиночные «поделиться местом» пропускаются): INSERT в `telegram_locations` (идемпотентно по `telegram_update_id`), upsert `telegram_profiles`, при наличии токена — кэширование аватара.
2. **Inline queries** (`@бот <запрос>` в любом чате) — поиск по title в `map_points`/`map_routes`, до 50 результатов, приоритет: места встреч → точки → маршруты; ссылки с UTM; `cache_time=60` (новые точки появляются в inline не мгновенно).
3. **Callback queries** — кнопка «Участвую», `callback_data = rsvp:<event_date_uuid>` (см. ниже).
4. **Команды** — `/start`, `/help` в личке.

## RSVP «Участвую»

1. Валидация UUID; отменённая дата (`cancelled = true`) отклоняется.
2. `ensureTelegramProfile` — upsert профиля **без** аватара (окно ответа callback узкое; аватар добьёт backfill).
3. Toggle в `map_event_participants`: есть строка → DELETE, нет → INSERT (конфликт 23505 = идемпотентный успех).
4. Пересчёт счётчика и `editMessageReplyMarkup` во **всех** живых анонсах этой даты во всех чатах (ошибки отдельных чатов не блокируют).
5. `answerCallbackQuery` — toast пользователю.

## Анонсы

- Текст = шапка (тип · название · дата, строится в `_pure.ts` и должна совпадать с превью `src/utils/eventAnnounce.ts`) + тело админа; экранируется, `parse_mode=HTML`.
- Отправка: `sendMessage`/`sendPhoto` (если есть `photo_path`) с инлайн-кнопкой «Участвую (N)» + ссылкой на карту; в форумных группах добавляется `message_thread_id` из `telegram_chats`.
- Каждая отправка фиксируется в `telegram_outbound_messages` (`sent_at` либо `send_error`); ответ — `{ sent: [...], failed: [...] }`.
- `pin=true` — best-effort `pinChatMessage` (`disable_notification=true`), ошибка не блокирует отправку.
- Правка: `editMessageText` / `editMessageCaption` (при фото). Если Telegram отвечает «message not found / can't be edited» — сообщение помечается `deleted_at` и выбывает из живых.
- Удаление: `deleteMessage` + `deleted_at` (мягкое — строка остаётся для истории).
- Новости — то же, но без шапки и без RSVP-кнопки, привязка `news_id`; источник текста — `map_news.body`.

## Аватары и безопасность bot-токена

Telegram отдаёт файлы по URL `/file/bot<TOKEN>/...` — токен нельзя допускать в БД/браузер:

1. Функция скачивает фото (`getUserProfilePhotos` → `getFile` → CDN);
2. загружает в публичный бакет `telegram-avatars`;
3. в `telegram_profiles.avatar_url` пишется только Storage-URL.

`isAvatarUrlSafe()` — проверка на `/file/bot`; фронтенд дополнительно санирует при чтении (`sanitizeTelegramAvatarUrl` → null для небезопасных URL).

**Backfill** (`POST /backfill?from=<offset>`): проходит профили окнами, обновляет пустые/небезопасные avatar_url, отвечает `{ processed, updated, failed, …, capped_at_max_profiles, next_from }` — при `capped_at_max_profiles: true` повторить с `?from=<next_from>`.

## Деплой и подключение

Деплой — автоматически из CI при push в `main` (`supabase functions deploy telegram-location-bot --no-verify-jwt --use-api`). Первичная настройка webhook:

```bash
curl -X POST "https://api.telegram.org/bot<bot_token>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<project-ref>.supabase.co/functions/v1/telegram-location-bot","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

Локально: `supabase functions serve telegram-location-bot` (для реального webhook нужен туннель ngrok/cloudflared).

## Инварианты

- Ссылки на события в текстах бота — сегмент `events` (`EVENTS_PATH_PREFIX`), **не** `/m/event/...`.
- Даты в анонсах форматируются в таймзоне Алматы (Asia/Almaty, UTC+5, без DST); хранение — UTC.
- Никаких новых секретов для анонсов/новостей не требуется — используются существующие.
- Логика построения текста анонса продублирована в превью фронтенда (`eventAnnounce.ts`) — менять синхронно.
