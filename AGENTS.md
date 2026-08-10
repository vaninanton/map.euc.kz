# Rules for agents and developers

Project: **map.euc.kz** — a PWA map for EUC (electric unicycle) riders in Almaty.
React 19 + TypeScript (strict) + Vite 8 + Tailwind 4 + Mapbox GL JS 3 + Supabase (PostgreSQL/RLS/Realtime/Storage/Deno Edge Functions), hosted on Cloudflare Pages.

Full documentation lives in [docs/](docs/README.md): architecture, frontend, DB, Telegram bot, events/news, admin panel, testing, deployment. Read the relevant file before changing a subsystem. **Change behavior — update docs/ in the same commit.**

## Language

UI strings, user-facing messages, code comments, `CHANGELOG.md` and commit descriptions are **Russian**. Identifiers are English. Developer documentation is English: `docs/`, `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`. `README.md` stays Russian — it is the public face of the repository. When editing an existing file, write in that file's language.

## Commands

```bash
npm run dev          # Vite dev server (localhost:5173, reachable over LAN)
npm run build        # vite build only (no type check — that is what CI does on deploy)
npm run build:check  # tsc -b && vite build
npm run lint         # ESLint (strictTypeChecked + react-hooks)
npm run format       # Prettier --write; format:check is the CI/hook gate
npm test             # Vitest, single run
npx vitest run src/utils/hashNav.test.ts   # one file
npm run test:e2e     # Playwright (Mapbox/Supabase mocks, production build)
npm run test:functions  # deno test for the edge functions
npm run secrets:sync # push edge-function secrets from .env.local
```

Pre-commit (Husky): `lint → format:check → tsc -b --noEmit → vitest → deno test → build → e2e`. Never bypass with `--no-verify`. Type checking must use `tsc -b` — `tsconfig.json` only holds project references.

## Code style

- **Prettier**: 4 spaces, width 120, single quotes, no semicolons, trailing commas. YAML — 2 spaces.
- **TypeScript**: strict, `noUnusedLocals/Parameters`. Avoid `any`; when unavoidable, add an explicit `eslint-disable` with justification.
- Imports: external libraries → internal by path → `type` imports. Alias `@/` → `src/` (Vite/Vitest only; Pages Functions under `functions/` are bundled by esbuild and need relative paths).
- Naming: PascalCase — components/types; camelCase — functions/hooks/variables; UPPER_SNAKE — global constants.
- Function components only, named export `export function ComponentName()`. Props go in a separate `ComponentNameProps` interface.
- Disabling hook rules: `// eslint-disable-next-line react-hooks/... -- краткое обоснование`.
- Effects with subscriptions keep the live callback in a ref (do not resubscribe every render).
- Short JSDoc for public functions/hooks/utils/edge functions.

### UI

- Tailwind classes only; global styles in `src/index.css`. Inline `style` only for dynamic values.
- UI colors from the Tailwind palette (neutral, white) or `UI_ACCENT`; map layer colors only from `COLORS` in `src/constants/index.ts`.
- Buttons: `type="button"`, `aria-label` where needed, decorative icons `aria-hidden`. Every `<button>` and `<a>` needs `cursor-pointer` (disabled — `cursor-not-allowed`).
- Responsive via `sm:`; safe area handled globally in `index.css`.
- Map controls only via `map.addControl(...)`, no custom classes.

## Layer separation

```
components/  UI without business logic     hooks/   state and effects
lib/         clients (supabase, mapLayers, env, analytics)
utils/       pure functions without React/Mapbox — ALL covered by tests
constants/   single source for LAYER_IDS, SOURCE_IDS, COLORS, labels, layer registry
admin/       lazy-loaded admin panel with its own adminApi
functions/   Cloudflare Pages Functions (OG tags, sitemap) — separate runtime, no React
```

Keep the boundaries: no query logic in components; no React/Mapbox in utils.

## Hard invariants (breaking one is a bug)

1. **Deep links**: map features use `/m/:type/:id` (`buildMapDeepLinkPath`, union `HashFeatureType`); events use **only** `/events/:id` (`buildEventDetailPath` from `src/utils/eventLinks.ts`). `/m/event/...` is a broken link. Build production links with `${import.meta.env.BASE_URL}` (base = `/`). A new entity with its own page ⇒ its own `build*Path`/`parse*Pathname` pair plus a route in `App.tsx`.
2. **Constants**: layer/source string IDs and colors come only from `src/constants/`. A new layer must be registered in `LAYER_IDS`, `SOURCE_IDS`, `CLICKABLE_LAYER_IDS`, `LAYER_ID_TO_KEY`, `LAYER_ID_TO_SOURCE`, `mapLayerRegistry.ts` and `layerVisibility.ts`.
3. **Migrations** — files in `supabase/migrations/` applied with `supabase db push` (or CI) only. **Never** via MCP `apply_migration`/`execute_sql` (it corrupts migration history; repair with `supabase migration repair`). Every new table ships with its RLS policies. A merge to `main` applies migrations to production immediately.
4. **Secrets**: the service-role key and the bot token live only in Edge Functions / Supabase secrets — never in the browser, the database, a URL or logs. Avatar URLs containing `/file/bot` are forbidden (sanitize them). Never commit `.env.local`.
5. **Analytics**: only `trackGoal`/`trackPageView` from `@/lib/analytics`; new goals go into the `MetrikaGoal` union. Metrika is fully disabled under `/admin/*`. Never call `ym()` directly.
6. **Mapbox**: one instance via `useMapbox`; before adding layers `if (map.getStyle() === undefined) return`; after `setStyle` layers are recreated on `style.load`; hover/select via feature-state, never React state; map padding only through `useMapPadding`.
7. **Resilience**: map data requests go through `withTimeoutAndRetry` and `Promise.allSettled`; a missing Supabase config must not crash the app.
8. **Announcements**: the announcement header text is built both in the bot (`_pure.ts`) and in the frontend preview (`utils/eventAnnounce.ts`) — change them together. "Live" bot messages are identified by `isLiveAnnouncement`/`isLiveNewsAnnouncement`.
9. **Pages Functions**: `functions/` is a separate esbuild-bundled runtime — no `@/` alias, no React, no `import.meta.env` (use the `env` binding). OG tags and `sitemap.xml` share the hourly entity dump in `_lib/entities.ts`.

## Tests are mandatory

- Any new functionality (component, hook, util, pure bot function) ships with a `*.test.ts(x)` next to the file. Do not close a task without tests.
- Bot logic starts as a pure function in `_pure.ts` + a Deno test.
- A new frontend query to Supabase ⇒ add a mock to `tests/e2e/fixtures.ts`, otherwise e2e fails.
- E2E runs in CI and in pre-commit; when touching UI selectors, run `npm run test:e2e` (or the affected spec) manually before pushing.
- Analytics mocks: `vi.hoisted`; env-dependent modules: `vi.stubEnv` + `vi.resetModules` + dynamic import.

## Environment

When adding a `VITE_*` variable, sync: `.github/workflows/deploy.yml`, `.env.example`, `.env.local`, `README.md` and the `build:e2e` script in `package.json`. `tests/config/deployConfig.test.ts` guards the parity. Offer to upload values from `.env.local`: sensitive — `gh secret set NAME --body "$NAME"`, non-sensitive — `gh variable set NAME --body "$NAME"`. Pages Functions read `SUPABASE_URL`/`SUPABASE_ANON_KEY` from the Cloudflare project settings.

## Commits and PRs

- Conventional Commits: `feat: …`, `fix: …`, `chore: …`, `ci: …`; imperative and short; the description is written in Russian.
- `CHANGELOG.md` is maintained in Russian, newest first, headings are `## YYYY-MM-DD (тема)` with `Added/Changed/Fixed` sections — no version numbers. Add an entry for notable changes.
- PR: describe the user-visible change, affected areas (map / admin / Supabase), migrations and new variables; screenshots for UI.

## Common tasks — where to look

| Task                          | Files / document                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| New map layer                 | `constants/*`, `lib/mapLayers.ts`, `hooks/useMapData.ts` → [docs/frontend.md](docs/frontend.md) |
| DB schema change              | `supabase/migrations/` → [docs/database.md](docs/database.md)                                   |
| Telegram bot logic            | `supabase/functions/telegram-location-bot/` → [docs/telegram-bot.md](docs/telegram-bot.md)      |
| Events / news / announcements | [docs/events-news.md](docs/events-news.md)                                                      |
| Admin pages                   | `src/admin/` → [docs/admin.md](docs/admin.md)                                                   |
| OG tags, sitemap, SEO         | `functions/` → [docs/deployment.md](docs/deployment.md)                                         |
| CI, backups, variables        | `.github/workflows/` → [docs/deployment.md](docs/deployment.md)                                 |
| PWA / Service Worker          | `public/sw.js`, `src/main.tsx` → [docs/frontend.md](docs/frontend.md)                           |

## Danger zones — change with extra care

- `src/lib/mapLayers.ts` — a bad paint expression means an invisible layer with no console error;
- `supabase/migrations/` (RLS) — a bad policy means leaked or unreachable data;
- `src/hooks/useMapData.ts` — realtime update races (the `telegramRefreshSeqRef` counter);
- `supabase/functions/telegram-location-bot/` — bot token leak risk;
- `public/sw.js` — a caching mistake strands users on a stale version;
- `functions/_lib/entities.ts` — the hourly dump feeds both OG previews and `sitemap.xml`; a bug hits every crawler at once.
