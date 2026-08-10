# Testing

Three levels: unit (Vitest), e2e (Playwright with full mocks), Deno tests for the edge functions. **Tests are mandatory for any new functionality** — put `*.test.ts(x)` next to the file.

## Commands

```bash
npm test                                # Vitest, single run
npx vitest run src/utils/hashNav.test.ts  # one file
npm run test:e2e                        # Playwright (runs build:e2e first)
npm run test:e2e:ui                     # interactive mode
npm run test:functions                  # deno test --allow-net supabase/functions/
npm run lint && npm run format:check    # code quality
```

## Unit (Vitest 4)

- The config is embedded in `vite.config.ts`: `environment: jsdom`, `globals: true`, `setupFiles: src/test/setup.ts`, excluding `supabase/functions/**` (those run under Deno).
- `src/test/setup.ts` — polyfills for `localStorage`/`sessionStorage`/`matchMedia` plus `@testing-library/jest-dom`.
- `src/test/eventFactories.ts` — factories for test events and event dates.
- Everything in `src/utils/*` is covered by tests; components and hooks are tested through RTL 16.
- Analytics: mock `react-metrika`/`@/lib/analytics` with `vi.hoisted`; for the env-dependent `metrikaCounterId` use `vi.stubEnv` + `vi.resetModules` + a dynamic import.
- `npm test` runs with `NODE_OPTIONS=--no-experimental-webstorage` (otherwise Node's webstorage clashes with jsdom).

## E2E (Playwright)

Files: `tests/e2e/*.e2e.ts` — map, sidebar, layers, events, radar, live-activity, share, routing.

- Runs against a **production build**: `pretest:e2e` → `npm run build:e2e` with dummy env vars (`VITE_SUPABASE_URL=https://e2e.supabase.co` and so on), served by `vite preview`.
- `playwright.config.ts`: chromium, 45 s test timeout / 10 s expect timeout, 2 retries on CI, `reuseExistingServer` locally.
- E2E type checking uses its own `tsconfig.playwright.json`.

### Mocks (`tests/e2e/fixtures.ts`)

Every external service is intercepted with `page.route`:

- Mapbox: style → a minimal object with a single background layer; telemetry → `{}`;
- Supabase Storage → a transparent 1×1 PNG;
- Supabase REST/RPC → hardcoded data: 2 points, 1 route, 3 events, 1 telegram location/profile; `map_points_submissions` POST → 201; unknown paths → 404.

When the frontend gains a new Supabase query, **add a mock to fixtures.ts** — otherwise e2e fails with a 404 or a timeout.

The `waitForSidebar()` helper waits for the «Информация об объекте» dialog.

E2E does run inside pre-commit, but it is the slowest gate: when touching UI selectors, run `npm run test:e2e` (or just the affected spec) manually before pushing instead of discovering the failure inside the hook.

## Edge Functions (Deno)

`supabase/functions/telegram-location-bot/_pure.test.ts` and `_handlers.test.ts`, plus `supabase/functions/ai-assist/_pure.test.ts` — all run by `npm run test:functions`. Pure logic is extracted into `_pure.ts` specifically to be testable; new bot behavior starts there with a test.

Deno must be on `PATH` (`~/.deno/bin`). Locally the pre-commit hook skips these tests when deno is missing; CI enforces them.

## Pre-commit (`.husky/pre-commit`)

```
npm run lint
npm run format:check
npx tsc -b --noEmit
npm test
npm run test:functions   # if deno is installed, otherwise a warning
npm run build
npm run test:e2e
```

The hook is slow on purpose — a full gate before every commit. Do not bypass it with `--no-verify` except in an emergency.

## CI (`.github/workflows/test.yml`)

On pull requests and on push to `main` (excluding `.md` and similar): job `checks` (lint → format → tsc → vitest → deno) and job `e2e` (chromium, playwright-report/test-results artifacts) run in parallel; on failure a Telegram notification is sent (PRs from forks have no secrets, so the notification is silently skipped).
