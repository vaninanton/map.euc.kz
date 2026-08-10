# Telegram bot (Edge Function `telegram-location-bot`)

The Deno function in `supabase/functions/telegram-location-bot/` is the single integration point with Telegram: receiving geolocations, inline search, RSVP, and broadcasting event and news announcements.

## Files

- `index.ts` — routing and entry point;
- `_handlers.ts` — handlers with I/O (Supabase + Telegram Bot API);
- `_pure.ts` — pure functions without I/O (text building, sanitization, validation) — covered by unit tests;
- `_handlers.test.ts`, `_pure.test.ts` — run with `npm run test:functions` (deno test).

The function is declared in `supabase/config.toml` with `verify_jwt = false`: the Telegram webhook arrives without a Supabase JWT, so authentication happens inside the function.

## Secrets (supabase secrets set)

| Secret                                      | Purpose                                                          |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database writes (provided by the platform automatically)         |
| `TELEGRAM_BOT_TOKEN`                        | Bot API calls (sending, avatars, callback answers)               |
| `TELEGRAM_WEBHOOK_SECRET`                   | Validates the webhook's `x-telegram-bot-api-secret-token` header |
| `TELEGRAM_BACKFILL_SECRET`                  | Authorizes `POST /backfill`                                      |
| `TELEGRAM_BACKFILL_MAX_PROFILES`            | Profile limit per backfill run (default 500)                     |
| `MAP_BASE_URL`                              | Link base used in announcements (default `https://map.euc.kz`)   |

## Route map

| Route                        | Authentication               | Purpose                                                 |
| ---------------------------- | ---------------------------- | ------------------------------------------------------- |
| `POST /` (webhook)           | secret-token header          | Telegram update: locations, inline, callback, commands  |
| `POST /backfill`             | `x-telegram-backfill-secret` | Re-fetch profile avatars                                |
| `POST /announce`             | admin JWT                    | Broadcast an event date announcement                    |
| `POST /announce-edit`        | admin JWT                    | Edit the text of every live announcement for a date     |
| `POST /announce-cancel`      | admin JWT                    | «❌ ОТМЕНЕНО» across every live announcement for a date |
| `POST /announce-delete`      | admin JWT                    | Delete announcement messages from Telegram              |
| `POST /announce-pin`         | admin JWT                    | Pin/unpin a single message                              |
| `POST /news-announce`        | admin JWT                    | Broadcast a news item                                   |
| `POST /news-announce-edit`   | admin JWT                    | Sync news text and a replaced photo (from `map_news`)   |
| `POST /news-announce-delete` | admin JWT                    | Delete news messages from Telegram                      |

The admin JWT is validated by presence in `map_admin_users`; the frontend calls the subroutes through `supabase.functions.invoke('telegram-location-bot/<subroute>', …)` (`src/admin/lib/adminApi/announceClient.ts`).

## Webhook: what it handles

1. **Live geolocations** — `message.location` with `live_period > 0` (one-off "share my location" pins are skipped): INSERT into `telegram_locations` (idempotent on `telegram_update_id`), upsert into `telegram_profiles`, and avatar caching when the token is available. When a broadcast **starts** in a group, the author receives an ephemeral onboarding card (see "Ephemeral messages").
2. **Inline queries** (`@bot <query>` in any chat) — title search across `map_points`/`map_routes`, up to 50 results, ordered meeting points → points → routes; links carry UTM; `cache_time=60` (so new points do not appear in inline results instantly).
3. **Callback queries** — the «Участвую» button, `callback_data = rsvp:<event_date_uuid>` (see below).
4. **Commands** — `/start`, `/help` in direct messages.

## RSVP «Участвую»

1. UUID validation; a cancelled date (`cancelled = true`) is rejected. The date is loaded together with its event (`starts_at`, `map_events`) for the ephemeral card.
2. `ensureTelegramProfile` — upserts the profile **without** an avatar (the callback response window is tight; backfill fills the avatar in later).
3. Toggle in `map_event_participants`: row exists → DELETE, otherwise INSERT (a 23505 conflict counts as idempotent success).
4. `answerCallbackQuery` — a short toast for the user.
5. An ephemeral confirmation card in the same chat (see "Ephemeral messages") — best-effort, only when the event loaded and a `chat_id` is known.
6. The counter is recomputed and `editMessageReplyMarkup` is applied to **every** live announcement for that date across all chats (a failure in one chat does not block the rest).

## Announcements

- Text = header (type · title · date, built in `_pure.ts` and required to match the preview in `src/utils/eventAnnounce.ts`) + the admin's body; escaped, `parse_mode=HTML`.
- Sending: `sendMessage`/`sendPhoto` (when `photo_path` exists) with an inline «Участвую (N)» button plus a map link; in forum groups the `message_thread_id` from `telegram_chats` is added.
- Every send is recorded in `telegram_outbound_messages` (`sent_at` or `send_error`); the response is `{ sent: [...], failed: [...] }`.
- `pin=true` — best-effort `pinChatMessage` (`disable_notification=true`); a failure does not block the send.
- Editing: `editMessageText` / `editMessageCaption` (with a photo). If Telegram answers "message not found / can't be edited", the message is marked `deleted_at` and drops out of the live set.
- Deleting: `deleteMessage` + `deleted_at` (soft — the row stays for history).
- News works the same way but without a header and without the RSVP button, linked via `news_id`; the text comes from `map_news.body`.

## Avatars and bot token safety

Telegram serves files from `/file/bot<TOKEN>/...` — that token must never reach the database or the browser:

1. The function downloads the photo (`getUserProfilePhotos` → `getFile` → CDN);
2. uploads it to the public `telegram-avatars` bucket;
3. writes only the Storage URL into `telegram_profiles.avatar_url`.

`isAvatarUrlSafe()` checks for `/file/bot`; the frontend sanitizes again on read (`sanitizeTelegramAvatarUrl` → null for unsafe URLs).

**Backfill** (`POST /backfill?from=<offset>`): walks profiles in windows, refreshes empty or unsafe avatar_urls, and answers `{ processed, updated, failed, …, capped_at_max_profiles, next_from }` — when `capped_at_max_profiles: true`, repeat with `?from=<next_from>`.

## Deployment and wiring

Deployment happens automatically from CI on push to `main` (`supabase functions deploy telegram-location-bot --no-verify-jwt --use-api`). Initial webhook setup:

```bash
curl -X POST "https://api.telegram.org/bot<bot_token>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<project-ref>.supabase.co/functions/v1/telegram-location-bot","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

Locally: `supabase functions serve telegram-location-bot` (a real webhook needs an ngrok/cloudflared tunnel).

## Ephemeral messages

**What it is.** The bot sends a **private reply inside a group chat, visible to one user only** (and the bot) — without cluttering the shared feed. It resolves the "spam the group ↔ direct message (requires Start)" dilemma: a private reply in the context of the same chat, with neither downside.

**API** (re-check against [core.telegram.org/bots/api](https://core.telegram.org/bots/api) when extending — the feature is new):

- Sending uses the existing methods (`sendMessage`, `sendPhoto`, …) plus a new `receiver_user_id` parameter (who sees it; `chat_id` is still required). For replying to a button press, `callback_query_id` is the alternative.
- `Message` gains `receiver_user` and `ephemeral_message_id` (the ephemeral message id within the chat) — both added to the `TelegramMessage` type in `_pure.ts`.
- Editing and deleting use dedicated methods `editEphemeralMessage*` / `deleteEphemeralMessage` (unused so far — we send a fresh ephemeral message per event).

**The shared primitive** is `sendEphemeralMessage(chatId, receiverUserId, text, botToken)` in `_handlers.ts`: `sendMessage` + `receiver_user_id`, `parse_mode=HTML`. It is **best-effort**: an error (including the feature not being available to the bot yet) is only logged and **does not affect** the main flow (writing the RSVP or the geolocation). It returns `ephemeral_message_id` (for a future edit) or `null`.

**Already shipped:**

1. **RSVP confirmation** (`handleCallbackQuery`) — on top of the short `answerCallbackQuery` toast we send a private card: on joining, «Ты в списке участников» + the event header (type · title · date) + a `/events/:id` deep link; on leaving, «Ты больше не участвуешь» + the header. The text is built by `buildRsvpEphemeralText` (`_pure.ts`), addressed with `receiver_user_id = cb.from.id` in `cb.message.chat.id`. It is sent only when the event loaded and the chat id is known.
2. **Live geolocation onboarding** (`handleLocationUpdate`) — when a broadcast **starts** (the update arrives as `message`, not `edited_message`; the `isLiveStart` flag comes from `index.ts`) in a **group**, the author privately sees a card: they are on the map (deep link `/m/telegramuser/<id>`), how many other riders are online, and who is nearest. Nothing is sent in direct messages (ephemeral messages are a group feature). The data is collected by `gatherLiveLocationStats` (the latest geolocation of each user inside `ACTIVE_RIDER_WINDOW_MINUTES`; the nearest one comes from `selectNearestRider` over `haversineMeters`, and if that rider is within `RIDER_AT_POINT_THRESHOLD_METERS` of any `map_points` entry, the point is shown as a landmark). The text comes from `buildLiveLocationEphemeralText`; with zero other riders it says «катаешь один».

**Potential (not implemented yet):**

- **Private answers to in-group commands** — `/спот`, `/розетки рядом`, `/маршрут N`, `/кто онлайн`: the answer is visible only to the asker; with an ephemeral command even the question is hidden.
- **Personal validation replies** — explaining to the author alone that a _live_ geolocation is required rather than a static one (today such an update is silently skipped).

## Invariants

- Event links in bot text use the `events` segment (`EVENTS_PATH_PREFIX`), **not** `/m/event/...`.
- Announcement dates are formatted in the Almaty timezone (Asia/Almaty, UTC+5, no DST); storage is UTC.
- Announcements and news need no new secrets — the existing ones cover them.
- The announcement text builder is duplicated in the frontend preview (`eventAnnounce.ts`) — change both together.
