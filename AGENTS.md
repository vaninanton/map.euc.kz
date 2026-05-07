# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript PWA for `map.euc.kz`. Application code lives in `src/`: `components/` for UI, `hooks/` for state and side effects, `lib/` for Supabase and Mapbox setup, `utils/` for pure helpers, `constants/` for layer IDs/config, `types/` for shared types, `data/` for static GeoJSON, and `admin/` for moderation/admin screens. Static PWA assets are in `public/`. Supabase schema changes live in `supabase/migrations/`, with the Telegram Edge Function in `supabase/functions/telegram-location-bot/`. Unit tests are colocated as `*.test.ts`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `cp .env.example .env.local` creates local configuration; fill Mapbox and Supabase values before running the app.
- `npm run dev` starts the Vite dev server, usually on `localhost:5173`.
- `npm run build` runs `tsc -b` and creates the production bundle.
- `npm test` runs Vitest once.
- `npx vitest run src/utils/hashNav.test.ts` runs one test file.
- `npm run lint` runs ESLint over the repository.
- `npm run preview` serves the built app locally.

## Coding Style & Naming Conventions

Use TypeScript strict mode and keep unused locals/parameters out of commits. Formatting follows the project convention documented in `CLAUDE.md`: 4-space indentation, 120-character line width, single quotes, no semicolons, and trailing commas where applicable. Prefer named React components in PascalCase, hooks named `useSomething`, utility files in camelCase, and constants in upper snake case when exported as fixed IDs. Keep `utils/` free of React and Mapbox dependencies where possible.

## Testing Guidelines

Vitest is the test runner. Add focused `*.test.ts` files beside the code under test, especially for transformations, geometry, parsing, selection, and route logic. For UI or hook changes, cover extracted pure logic when practical and run `npm test` plus `npm run lint` before handing off.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit-style prefixes such as `feat:` and `chore:`; keep messages imperative and scoped, for example `feat: add route elevation stats`. Pull requests should describe the user-visible change, mention affected map/admin/Supabase areas, link related issues, include screenshots for UI changes, and note any required environment variables, migrations, or Edge Function deployment steps.

## Security & Configuration Tips

Never commit `.env.local` or service-role secrets. Browser code must use publishable Supabase keys only and rely on RLS. Keep Telegram bot tokens in Supabase secrets, and avoid storing token-bearing URLs in database rows or public assets.
