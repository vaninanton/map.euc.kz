# Правила для агентов и разработчиков

Проект: **map.euc.kz** — PWA-карта для райдеров на моноколёсах (EUC) в Алматы.
React 19 + TypeScript (strict) + Vite 8 + Tailwind 4 + Mapbox GL JS 3 + Supabase (PostgreSQL/RLS/Realtime/Storage/Deno Edge Functions).

Полная документация — в [docs/](docs/README.md): архитектура, фронтенд, БД, Telegram-бот, события/новости, админка, тесты, деплой. Прочитайте профильный файл перед изменением соответствующей подсистемы. **Изменили поведение — обновите docs/ в том же коммите.**

## Язык

UI-тексты, сообщения пользователю, комментарии в коде, коммиты по смыслу — **русский**. Идентификаторы — английский.

## Команды

```bash
npm run dev          # Vite dev server (localhost:5173, доступен по сети)
npm run build:check  # tsc -b && vite build
npm run lint         # ESLint (strictTypeChecked + react-hooks)
npm test             # Vitest, один прогон
npx vitest run src/utils/hashNav.test.ts   # один файл
npm run test:e2e     # Playwright (моки Mapbox/Supabase, прод-сборка)
npm run test:functions  # deno test для edge-функции
npm run format       # Prettier
```

Pre-commit (Husky): `lint → format:check → tsc → vitest → deno test → build → e2e`. Не обходить `--no-verify`.

## Стиль кода

- **Prettier**: 4 пробела, ширина 120, одинарные кавычки, без точек с запятой, trailing commas. YAML — 2 пробела.
- **TypeScript**: strict, `noUnusedLocals/Parameters`. `any` избегать; при необходимости — явный `eslint-disable` с обоснованием.
- Импорты: внешние библиотеки → внутренние по пути → `type`-импорты. Alias `@/` → `src/`.
- Именование: PascalCase — компоненты/типы; camelCase — функции/хуки/переменные; UPPER_SNAKE — глобальные константы.
- Только функциональные компоненты, именованный экспорт `export function ComponentName()`. Пропсы — отдельный интерфейс `ComponentNameProps`.
- Отключение правил хуков — `// eslint-disable-next-line react-hooks/... -- краткое обоснование`.
- В эффектах с подписками — ref на актуальный колбэк (не переподписываться каждый рендер).
- Для публичных функций/хуков/утилит/edge functions — краткий JSDoc.

### UI

- Только Tailwind-классы; глобальные стили — `src/index.css`. Инлайн `style` — только для динамических значений.
- Цвета UI — палитра Tailwind (neutral, white); цвета слоёв карты — только `COLORS` из `src/constants/index.ts`.
- Кнопки: `type="button"`, `aria-label` где нужно, декоративные иконки `aria-hidden`. На всех `<button>` и `<a>` обязателен `cursor-pointer` (disabled — `cursor-not-allowed`).
- Адаптив через `sm:`; safe area — глобально в `index.css`.
- Map controls — только `map.addControl(...)`, без кастомных классов.

## Разделение слоёв

```
components/  UI без бизнес-логики        hooks/   состояние и эффекты
lib/         клиенты (supabase, mapLayers, env, analytics)
utils/       чистые функции без React/Mapbox — ВСЕ покрыты тестами
constants/   единственный источник LAYER_IDS, SOURCE_IDS, COLORS, подписей
admin/       lazy-loaded админка со своим adminApi
```

Не размывать: логика запросов — не в компонентах; React/Mapbox — не в utils.

## Жёсткие инварианты (нарушение = баг)

1. **Deep links**: фичи карты — `/m/:type/:id` (`buildMapDeepLinkPath`, union `HashFeatureType`); события — **только** `/events/:id` (`buildEventDetailPath` из `src/utils/eventLinks.ts`). `/m/event/...` — битая ссылка. В prod ссылки строить с `${import.meta.env.BASE_URL}` (base = `/map.euc/`). Новая сущность со страницей ⇒ свой `build*Path`/`parse*Pathname` + маршрут в `App.tsx`.
2. **Константы**: строковые ID слоёв/источников и цвета — только из `src/constants/index.ts`. Новый слой — регистрировать в `LAYER_IDS`, `SOURCE_IDS`, `CLICKABLE_LAYER_IDS`, `LAYER_ID_TO_KEY`, `LAYER_ID_TO_SOURCE`, `mapLayerRegistry.ts`, `layerVisibility.ts`.
3. **Миграции** — только файлы в `supabase/migrations/` + `supabase db push` (или CI). **Никогда** через MCP `apply_migration`/`execute_sql` (ломает историю миграций; чинить `supabase migration repair`). Каждая новая таблица — сразу с RLS-политиками.
4. **Секреты**: service-role ключ и bot-токен — только в Edge Function/Supabase secrets, никогда в браузере, БД, URL или логах. Avatar-URL с `/file/bot` — запрещены (санировать). Не коммитить `.env.local`.
5. **Аналитика**: только `trackGoal`/`trackPageView` из `@/lib/analytics`; новые цели — в union `MetrikaGoal`. В `/admin/*` Метрика полностью отключена. Не вызывать `ym()` напрямую.
6. **Mapbox**: один инстанс через `useMapbox`; перед добавлением слоёв — `if (map.getStyle() === undefined) return`; после `setStyle` слои пересоздаются на `style.load`; hover/select — через feature-state, не через React-state.
7. **Устойчивость**: запросы данных карты — через `withTimeoutAndRetry` и `Promise.allSettled`; отсутствие Supabase-конфига не должно ронять приложение.
8. **Анонсы**: текст шапки анонса строится и в боте (`_pure.ts`), и в превью фронта (`utils/eventAnnounce.ts`) — менять синхронно. «Живые» сообщения бота определяются `isLiveAnnouncement`/`isLiveNewsAnnouncement`.

## Тесты — обязательны

- Любой новый функционал (компонент, хук, утилита, чистая функция бота) — с `*.test.ts(x)` рядом с файлом. Не закрывать задачу без тестов.
- Логика бота — сначала чистая функция в `_pure.ts` + deno-тест.
- Новый запрос фронтенда к Supabase ⇒ добавить мок в `tests/e2e/fixtures.ts`, иначе e2e упадут.
- E2E гоняются в CI и pre-commit; при правке UI-селекторов прогнать `npm run test:e2e` вручную до пуша.
- Моки аналитики: `vi.hoisted`; env-зависимые модули: `vi.stubEnv` + `vi.resetModules` + динамический импорт.

## Окружение

При добавлении `VITE_*`-переменной синхронизировать: `.github/workflows/deploy.yml`, `.env.example`, `.env.local`, `README.md` (+ `build:e2e` в `package.json`). Значения из `.env.local` предлагать командами: чувствительные — `gh secret set NAME --body "$NAME"`, некритичные — `gh variable set NAME --body "$NAME"`.

## Коммиты и PR

- Conventional Commits: `feat: …`, `fix: …`, `chore: …`, `ci: …`; императив, кратко; тело — по-русски допустимо.
- CHANGELOG.md ведётся (`Added/Changed/Fixed` под датой) — дополняйте при заметных изменениях.
- PR: описать пользовательское изменение, затронутые зоны (карта/админка/Supabase), миграции и новые переменные; скриншоты для UI.

## Типовые задачи — куда смотреть

| Задача                     | Файлы / документ                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Новый слой карты           | `constants/*`, `lib/mapLayers.ts`, `hooks/useMapData.ts` → [docs/frontend.md](docs/frontend.md) |
| Изменение схемы БД         | `supabase/migrations/` → [docs/database.md](docs/database.md)                                   |
| Логика Telegram-бота       | `supabase/functions/telegram-location-bot/` → [docs/telegram-bot.md](docs/telegram-bot.md)      |
| События / новости / анонсы | [docs/events-news.md](docs/events-news.md)                                                      |
| Страницы админки           | `src/admin/` → [docs/admin.md](docs/admin.md)                                                   |
| CI, бэкапы, переменные     | `.github/workflows/` → [docs/deployment.md](docs/deployment.md)                                 |
| PWA / Service Worker       | `public/sw.js`, `src/main.tsx` → [docs/frontend.md](docs/frontend.md)                           |

## Опасные зоны — менять с особой осторожностью

- `src/lib/mapLayers.ts` — ошибка в paint-выражении = невидимый слой без ошибок в консоли;
- `supabase/migrations/` (RLS) — ошибка политики = утечка или недоступность данных;
- `src/hooks/useMapData.ts` — гонки realtime-обновлений (счётчик `telegramRefreshSeqRef`);
- `supabase/functions/telegram-location-bot/` — риск утечки bot-токена;
- `public/sw.js` — ошибка кеширования = пользователи застревают на старой версии.
