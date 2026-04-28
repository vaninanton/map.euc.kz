# Мономаршруты (map.euc.kz)

Карта точек, розеток и маршрутов для моноколёс в Алматы.

## Telegram-бот: сбор геопозиций в Supabase

Реализован webhook через Edge Function `telegram-location-bot`: он принимает `update` от Telegram и сохраняет сообщения с `location` в таблицу `telegram_locations`.
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
     -d '{"url":"https://sbfnottcjbbgoucfwbzs.supabase.co/functions/v1/telegram-location-bot/<bot_token>","secret_token":"<random_secret>"}'
   ```

После этого любые сообщения с геопозицией в чате, где есть бот, будут попадать в `telegram_locations`.
