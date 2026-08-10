# Events and news

## Events: public side

Routes: `/events` (feed) and `/events/:eventId` (detail). Build them **only** with `buildEventDetailPath()` from `src/utils/eventLinks.ts`; `event` is not part of `HashFeatureType`, so `/m/event/:id` is a broken link.

- `EventsScreen` — the feed with a type filter (`group_ride` «Покатушка», `event` «Мероприятие», `training` «Обучение»), sorted by the nearest occurrence; calls `markAsRead()` when opened.
- `EventCard` — preview: photo, type, schedule (`summarizeEvent`: next / ongoing / schedule / isPast).
- `EventDetailScreen` — photo, description (through `applyTypography`), schedule, place, start/finish (`EndpointRow`: navigates to the linked point or centers on the coordinates), `EventShareBlock` (Telegram + copy).
- `PointEventsBlock` — the «События здесь» block in a point card (the point is the start or the finish of an event, `eventsForPoint()`).
- `BottomTabBar` — the «События» tab with an unread badge.

### Data

`useEvents` (`src/hooks/useEvents.ts`) loads `fetchEvents()` (`lib/supabase.ts`) once:
`map_events` (WHERE `flag_disabled = false`) with nested `map_event_dates` and the linked start/finish points; normalized into `EventRow` with a computed `photo_url`.

Scheduling lives in `src/utils/eventSchedule.ts`:

- `validOccurrences()` — non-cancelled dates only (the single `cancelled` filter);
- `getNextOccurrence()` — the first future occurrence;
- `formatOccurrenceLabel()` — «Сегодня в 19:00», «Завтра в 19:00», «14 июля, 19:00–20:30»;
- an event counts as _ongoing_ within `[start, start + duration]`, defaulting to 60 minutes.

### Unread badge

`src/utils/eventsReadStore.ts`, localStorage key `map-euc-events-last-read`:
unread = an event that has a future occurrence AND `created_at > lastReadAt`. Fully past events never count as new; if the feed has never been opened, every current event is new.

## Events: admin panel

Routes: `/admin/event`, `/admin/event/new`, `/admin/event/:id`.

- `EventsPage` — the list: nearest date, date counter, `flag_disabled` toggle, filter chips (Предстоящие / Прошедшие / Без даты / Все, with counts) and title search. Sorting follows the group — upcoming by the nearest date ascending, past by the most recent descending, dateless by creation date. The pure logic lives in `src/admin/utils/eventDates.ts`; the page only renders it.
- `EventEditPage` — `EventForm` (type, title, description, duration, place: a point or raw coordinates) + `EventPhotoManager` (bucket `map-event-photos`) + `EventDatesManager`.
- `EventForm` — in create mode it also renders a **required** first date (`withFirstDate`), prefilled with the next `DEFAULT_EVENT_HOUR` slot in the future. A date in the past is allowed but flagged with a warning. In edit mode the block is absent: dates belong to `EventDatesManager`.
- `EventDatesManager` — CRUD over dates (starts_at, note, cancelled), an expandable RSVP participant list, and a «Telegram» button opening `EventAnnounceModal`. Past dates are collapsed behind a toggle, «+1 неделя» clones the last date one week later (carrying its note), and deletion goes through `ConfirmDialog`.
- `EventAnnounceModal` — mode `send` (header preview + body textarea + chat checkboxes from `pendingAnnouncementChats()` + a «Закрепить» flag) and mode `edit` (edit / send to remaining chats / delete).
- `AnnouncementMessagesList` — delivery history with status indicators (sent / error / cancelled / deleted) and pin/unpin.

adminApi: `events.ts` (CRUD over events/dates/photos), `eventAnnouncements.ts` (announce/edit/cancel/delete/pin, participants); edge function calls go through `announceClient.ts` → the `announce*` subroutes (see [telegram-bot.md](telegram-bot.md)).

`listEvents()` returns `AdminEventListItem` — the event plus its nested dates, fetched in the same query so the list can sort by the nearest date without an N+1.

`createEvent(input, firstDate)` takes the first date as a **required** second argument and inserts it right after the event. There is no cross-table transaction from the browser, so a failed date insert rolls the event back and rethrows the original error — the form shows it with the fields intact. If the rollback itself fails, it is logged to the console and the event stays dateless (visible in the list under «Без даты»).

Deleting an event is a **hard delete** (cascading to dates, participants and outbound messages); the photo is removed from Storage before the row is deleted.

## Announcement flow for an event date

```
Admin → EventDatesManager → EventAnnounceModal (pick chats, pin)
  → announceEventDate(eventDateId, messageText, destinationIds, pin)
  → invokeAnnounce('announce', …)  [admin JWT]
  → Edge Function: header + body → sendMessage/sendPhoto with an «Участвую (0)» button
  → rows in telegram_outbound_messages (sent_at | send_error)
  → { sent: [...], failed: [...] }

Edit   → 'announce-edit'   (editMessageText/Caption across every live message)
Cancel → 'announce-cancel' («❌ ОТМЕНЕНО» text, button removed, cancelled_at)
Delete → 'announce-delete' (deleteMessage + deleted_at)
Pin    → 'announce-pin'    (pinChatMessage / unpin, pinned_at)

RSVP: a user taps «Участвую» in Telegram → callback_query → toggles
map_event_participants → the button counter is recomputed in EVERY chat of that date.
```

## News

There is no public page — news items are written in the admin panel and broadcast by the bot into chats.

Routes: `/admin/news`, `/admin/news/new`, `/admin/news/:id`.

- `NewsPage` — the list (preview = the first non-empty line of body, `newsTitlePreview()`), soft delete.
- `NewsEditPage` — a `body` textarea (the single source of truth) + `NewsPhotoManager` (bucket `map-news-photos`) + `NewsAnnounceManager`.
- `NewsAnnounceManager` — chat selection and sending (`news-announce`), syncing the text and a replaced photo into every live message (`news-announce-edit` — reads the current body and photo_path from the database), deleting from Telegram (`news-announce-delete`); it warns about unsaved changes before syncing.

Replacing the photo of already-sent messages (`news-announce-edit`) only works «photo → another photo» via `editMessageMedia`; on success the row's `photo_path` is updated. You cannot add a photo to a message that has none, or strip the photo from one that has it — Telegram does not convert a media message into a text message or back, so such an edit is limited to the caption/text.

adminApi: `news.ts`, `newsAnnouncements.ts`; utilities in `src/utils/newsAnnounce.ts` (`isLiveNewsAnnouncement`, `pendingNewsChats`, `newsTitlePreview`).

Deleting a news item is a **soft delete** (`deleted_at`); the photo is removed from Storage.

## Broadcast chats

`/admin/telegram-chats` (`TelegramChatsPage`) manages the `telegram_chats` table: `chat_id`, `title`, `enabled`, `sort_order`, `message_thread_id` (a forum group topic; NULL means a plain chat). One physical chat may have several rows for different topics — UNIQUE `(chat_id, message_thread_id) NULLS NOT DISTINCT`.

## Invariants

1. A link to an event is always `/events/:id` (`buildEventDetailPath`) — including in bot messages (`EVENTS_PATH_PREFIX`).
2. `telegram_outbound_messages` is polymorphic: exactly one of `event_date_id` / `news_id` (enforced by a CHECK).
3. A "live" message = sent, no error, not cancelled, not deleted — only those get edited or deleted.
4. `body_text` (events) and `map_news.body` (news) are the raw bodies used for re-editing; the row's `message_text` and `photo_path` are a snapshot of what was sent (`photo_path` changes only on an actual photo replacement through `editMessageMedia`).
5. The announcement header is built both in the bot's `_pure.ts` and in the frontend's `eventAnnounce.ts` — change them together.
6. A cancelled date (`cancelled`) is excluded from the schedule (`validOccurrences`) and rejects RSVP. In the admin list it is also excluded from "nearest date", so an event whose every date is cancelled shows up as «Без даты» rather than silently looking scheduled.
7. An event is always created with a date (`createEvent` requires one). Dateless events can still appear — from a failed rollback or a deleted last date — and the «Без даты» filter exists to surface them.
