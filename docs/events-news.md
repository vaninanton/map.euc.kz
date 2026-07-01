# События и новости

## События: публичная часть

Маршруты: `/events` (лента) и `/events/:eventId` (детали). Строятся **только** через `buildEventDetailPath()` из `src/utils/eventLinks.ts`; `event` не входит в `HashFeatureType`, поэтому `/m/event/:id` — битая ссылка.

- `EventsScreen` — лента с фильтром по типу (`group_ride` «Покатушка», `event` «Мероприятие», `training` «Обучение»), сортировка по ближайшему вхождению; при открытии вызывает `markAsRead()`.
- `EventCard` — превью: фото, тип, расписание (`summarizeEvent`: next / ongoing / schedule / isPast).
- `EventDetailScreen` — фото, описание (через `applyTypography`), расписание, место, старт/финиш (`EndpointRow`: переход на привязанную точку либо центрирование по координатам), `EventShareBlock` (Telegram + копирование).
- `PointEventsBlock` — блок «События здесь» в карточке точки (точка = старт или финиш события, `eventsForPoint()`).
- `BottomTabBar` — таб «События» с бейджем непрочитанных.

### Данные

`useEvents` (`src/hooks/useEvents.ts`) один раз грузит `fetchEvents()` (`lib/supabase.ts`):
`map_events` (WHERE `flag_disabled = false`) c вложенными `map_event_dates` и привязанными точками старта/финиша; нормализация в `EventRow` с вычисленным `photo_url`.

Расписание — `src/utils/eventSchedule.ts`:

- `validOccurrences()` — только неотменённые даты (единственный фильтр `cancelled`);
- `getNextOccurrence()` — первое будущее вхождение;
- `formatOccurrenceLabel()` — «Сегодня в 19:00», «Завтра в 19:00», «14 июля, 19:00–20:30»;
- «идущим» событие считается в интервале `[start, start + duration]`, default 60 мин.

### Бейдж непрочитанных

`src/utils/eventsReadStore.ts`, localStorage `map-euc-events-last-read`:
непрочитанное = событие с будущим вхождением И `created_at > lastReadAt`. Полностью прошедшие события новыми не считаются; если ленту ни разу не открывали — все актуальные события новые.

## События: админка

Маршруты: `/admin/event`, `/admin/event/new`, `/admin/event/:id`.

- `EventsPage` — список, toggle `flag_disabled`.
- `EventEditPage` — `EventForm` (тип, название, описание, длительность, место: точка или координаты) + `EventPhotoManager` (бакет `map-event-photos`) + `EventDatesManager`.
- `EventDatesManager` — CRUD дат (starts_at, note, cancelled), раскрывающийся список участников RSVP, кнопка «Telegram» → `EventAnnounceModal`.
- `EventAnnounceModal` — режимы `send` (превью шапки + textarea тела + чекбоксы чатов из `pendingAnnouncementChats()` + флаг «Закрепить») и `edit` (правка/до-отправка/удаление).
- `AnnouncementMessagesList` — история отправок с индикаторами (успех/ошибка/отменено/удалено) и pin/unpin.

adminApi: `events.ts` (CRUD событий/дат/фото), `eventAnnouncements.ts` (announce/edit/cancel/delete/pin, участники), вызовы edge-функции через `announceClient.ts` → сабруты `announce*` (см. [telegram-bot.md](telegram-bot.md)).

Удаление события — **hard delete** (каскад на даты, участников и исходящие сообщения); фото удаляется из Storage перед удалением записи.

## Поток анонса даты события

```
Админ → EventDatesManager → EventAnnounceModal (выбор чатов, pin)
  → announceEventDate(eventDateId, messageText, destinationIds, pin)
  → invokeAnnounce('announce', …)  [JWT администратора]
  → Edge Function: шапка + тело → sendMessage/sendPhoto с кнопкой «Участвую (0)»
  → записи в telegram_outbound_messages (sent_at | send_error)
  → { sent: [...], failed: [...] }

Правка   → 'announce-edit'   (editMessageText/Caption во всех живых сообщениях)
Отмена   → 'announce-cancel' (текст «❌ ОТМЕНЕНО», снятие кнопки, cancelled_at)
Удаление → 'announce-delete' (deleteMessage + deleted_at)
Пин      → 'announce-pin'    (pinChatMessage / unpin, pinned_at)

RSVP: пользователь жмёт «Участвую» в Telegram → callback_query → toggle
map_event_participants → пересчёт счётчика на кнопке во ВСЕХ чатах даты.
```

## Новости

Публичной страницы нет — новости пишутся в админке и рассылаются ботом в чаты.

Маршруты: `/admin/news`, `/admin/news/new`, `/admin/news/:id`.

- `NewsPage` — список (превью = первая непустая строка body, `newsTitlePreview()`), мягкое удаление.
- `NewsEditPage` — textarea `body` (единственный источник истины) + `NewsPhotoManager` (бакет `map-news-photos`) + `NewsAnnounceManager`.
- `NewsAnnounceManager` — выбор чатов и отправка (`news-announce`), синхронизация текста во все живые сообщения (`news-announce-edit` — берёт актуальный body из БД), удаление из Telegram (`news-announce-delete`); предупреждает о несохранённых изменениях перед синхронизацией.

adminApi: `news.ts`, `newsAnnouncements.ts`; утилиты — `src/utils/newsAnnounce.ts` (`isLiveNewsAnnouncement`, `pendingNewsChats`, `newsTitlePreview`).

Удаление новости — **soft delete** (`deleted_at`), фото удаляется из Storage.

## Чаты рассылки

`/admin/telegram-chats` (`TelegramChatsPage`) → таблица `telegram_chats`: `chat_id`, `title`, `enabled`, `sort_order`, `message_thread_id` (тема форумной группы; NULL — обычный чат). Один физический чат может иметь несколько записей с разными темами — UNIQUE `(chat_id, message_thread_id) NULLS NOT DISTINCT`.

## Инварианты

1. Ссылка на событие — только `/events/:id` (`buildEventDetailPath`); это касается и текстов бота (`EVENTS_PATH_PREFIX`).
2. `telegram_outbound_messages` полиморфна: ровно один из `event_date_id` / `news_id` (CHECK).
3. «Живое» сообщение = отправлено, без ошибки, не отменено, не удалено — только такие правятся/удаляются.
4. `body_text` (события) и `map_news.body` (новости) — сырые тела для повторной правки; `message_text` — снапшот отправленного.
5. Шапка анонса строится в `_pure.ts` бота и в `eventAnnounce.ts` фронта — менять синхронно.
6. Отменённая дата (`cancelled`) не участвует в расписании (`validOccurrences`) и отклоняет RSVP.
