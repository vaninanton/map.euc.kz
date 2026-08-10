# map.euc.kz documentation

A PWA map for EUC (electric unicycle) riders in Almaty — live at **map.euc.kz**.
Meeting points, power sockets, routes, bike lanes, live geolocations from Telegram chats, community events and news.

This directory is the canonical documentation for the project. Current as of **2026-08-10**.
When behavior, the database schema or the routes change, update the relevant file here in the same commit.

## Documentation map

| File                               | Contents                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md) | Overall architecture: topology, data flows, key patterns, repository layout                         |
| [frontend.md](frontend.md)         | SPA: routes, components, hooks, constants, `lib/`, `utils/`, PWA/Service Worker, analytics          |
| [database.md](database.md)         | Supabase: every table, RLS policies, enums, RPC, Storage buckets, migration rules                   |
| [telegram-bot.md](telegram-bot.md) | Edge Function `telegram-location-bot`: webhook, inline mode, RSVP, announcements, backfill, secrets |
| [events-news.md](events-news.md)   | The events and news subsystem: public UI, admin panel, Telegram broadcasts                          |
| [admin.md](admin.md)               | Admin panel `/admin`: authentication, routes, adminApi, route editor, components                    |
| [testing.md](testing.md)           | Testing: Vitest, Playwright (mocks), Deno tests for the edge functions, pre-commit                  |
| [deployment.md](deployment.md)     | CI/CD: deploy/test/backup workflows, variables and secrets, local Supabase, Cloudflare Pages        |

## Development rules

- **[../AGENTS.md](../AGENTS.md)** — rules for AI agents and developers: code style, invariants, checklists, prohibitions.
- **[../CLAUDE.md](../CLAUDE.md)** — instructions for Claude Code (kept in sync with AGENTS.md).
- **[../.claude/skills/](../.claude/skills/)** — Claude Code skills: `commit`, `git-feature-workflow`, `supabase-backup`, `supabase-clone-prod`, `update-bike-paths`, `update-deps`.
- **[../CHANGELOG.md](../CHANGELOG.md)** — the log of notable changes (written in Russian; headings carry a date only, no version numbers).

## Language

This documentation, `AGENTS.md`, `CLAUDE.md` and the skills are written in English. User-facing content stays Russian: UI strings, code comments, `CHANGELOG.md`, commit descriptions and [../README.md](../README.md).

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in VITE_MAPBOX_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # localhost:5173
```

The full list of commands and environment variables is in [deployment.md](deployment.md); the user-facing overview is in [../README.md](../README.md).
