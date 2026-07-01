# Тестирование

Три уровня: unit (Vitest), e2e (Playwright с полными моками), Deno-тесты edge-функции. **Тесты обязательны для любого нового функционала** — `*.test.ts(x)` рядом с файлом.

## Команды

```bash
npm test                                # Vitest, один прогон
npx vitest run src/utils/hashNav.test.ts  # один файл
npm run test:e2e                        # Playwright (сначала build:e2e)
npm run test:e2e:ui                     # интерактивный режим
npm run test:functions                  # deno test --allow-net supabase/functions/
npm run lint && npm run format:check    # качество кода
```

## Unit (Vitest 4)

- Конфиг встроен в `vite.config.ts`: `environment: jsdom`, `globals: true`, `setupFiles: src/test/setup.ts`, exclude `supabase/functions/**` (это Deno).
- `src/test/setup.ts` — полифиллы `localStorage`/`sessionStorage`/`matchMedia` + `@testing-library/jest-dom`.
- `src/test/eventFactories.ts` — фабрики тестовых событий/дат.
- Все `src/utils/*` покрыты тестами; компоненты и хуки тестируются через RTL 16.
- Аналитика: мокать `react-metrika`/`@/lib/analytics` через `vi.hoisted`; env-зависимый `metrikaCounterId` — `vi.stubEnv` + `vi.resetModules` + динамический импорт.
- `npm test` запускается с `NODE_OPTIONS=--no-experimental-webstorage` (иначе конфликт webstorage Node с jsdom).

## E2E (Playwright)

Файлы: `tests/e2e/*.e2e.ts` — map, sidebar, layers, events, radar, live-activity, share.

- Прогон на **production-сборке**: `pretest:e2e` → `npm run build:e2e` с фиктивными env (`VITE_SUPABASE_URL=https://e2e.supabase.co` и т.д.), сервер — `vite preview`.
- Конфиг `playwright.config.ts`: chromium, таймаут теста 45 с / expect 10 с, retries 2 на CI, `reuseExistingServer` локально.
- Тип-чек e2e — отдельный `tsconfig.playwright.json`.

### Моки (`tests/e2e/fixtures.ts`)

Все внешние сервисы перехватываются `page.route`:

- Mapbox: стиль → минимальный объект с одним background-слоем; телеметрия → `{}`;
- Supabase Storage → прозрачный PNG 1×1;
- Supabase REST/RPC → захардкоженные данные: 2 точки, 1 маршрут, 3 события, 1 telegram-локация/профиль; `map_points_submissions` POST → 201; неизвестные пути → 404.

При добавлении нового запроса к Supabase из фронтенда — **добавить мок в fixtures.ts**, иначе e2e падают по 404/таймауту.

Хелпер `waitForSidebar()` ждёт диалог «Информация об объекте».

E2E **не входят** в обязательный CI-гейт мгновенно локально: в pre-commit они запускаются, но при правке UI-селекторов прогоняйте `npm run test:e2e` вручную до пуша.

## Edge Function (Deno)

`supabase/functions/telegram-location-bot/_pure.test.ts`, `_handlers.test.ts` — `npm run test:functions`. Чистая логика вынесена в `_pure.ts` специально для тестируемости; новые функции бота — сначала в `_pure.ts` с тестом.

## Pre-commit (`.husky/pre-commit`)

```
npm run lint
npm run format:check
npx tsc -b --noEmit
npm test
npm run test:functions   # если установлен deno, иначе предупреждение
npm run build
npm run test:e2e
```

Хук небыстрый — это осознанный выбор (полный гейт перед каждым коммитом). Не обходить `--no-verify` без крайней необходимости.

## CI (`.github/workflows/test.yml`)

На PR и push в `main` (кроме `.md` и т.п.): job `checks` (lint → format → tsc → vitest → deno) и job `e2e` (chromium, артефакты playwright-report/test-results) параллельно; при падении — уведомление в Telegram (на PR из форков секретов нет — уведомление молча не уходит).
