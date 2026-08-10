---
name: update-deps
description: Update npm dependencies for map.euc.kz. Use when asked to update packages, check outdated dependencies, bump versions, upgrade npm deps, or run npm-check-updates. Handles minor/patch updates automatically and major updates with breaking-change analysis and confirmation.
---

Update npm dependencies for map.euc.kz. The workflow creates a new git branch, classifies each outdated package as minor/patch vs major, applies safe updates immediately, researches breaking changes for major bumps, then verifies with build + tests before reporting.

**Check Dependabot first.** `.github/dependabot.yml` already opens daily PRs for minor/patch bumps — grouped into `dev-dependencies` and `production-minor-patch` — plus weekly GitHub Actions updates. Major bumps are deliberately left ungrouped, one PR each, for manual analysis. So run `gh pr list --label dependencies` before doing anything: if an open Dependabot PR already covers the request, review and merge that instead of duplicating the work by hand. This skill is for manual sweeps and for the major bumps Dependabot cannot decide on its own.

## Process

### 1. Create branch

```bash
git checkout main
git pull
git checkout -b deps/update-$(date +%Y-%m-%d)
```

### 2. Check what's outdated

```bash
npm outdated
```

Output columns: `Package | Current | Wanted | Latest | Location | Depended by`

- **Wanted** = highest version matching `package.json` semver range (safe to install with `npm install`)
- **Latest** = published latest (may be a major bump)
- If `Current == Latest` → nothing to do for that package

### 3. Classify updates

**Minor/patch** (Current → Latest stays within the same major): update immediately.

**Major** (Current major < Latest major): research first:

1. Find the package's GitHub/npm page
2. Look for CHANGELOG, MIGRATION, or upgrade guide
3. Check release notes between Current and Latest for breaking changes
4. Explain the breaking changes to the user and ask for confirmation before applying

### 4. Apply minor/patch updates

```bash
npx npm-check-updates -u --target minor
npm install
```

Or for individual packages:

```bash
npm install <package>@latest
```

### 5. Apply major updates (after confirmation)

```bash
npx npm-check-updates -u --target latest --filter <package-name>
npm install
```

Follow the upgrade guide for each package. Common patterns in this project:

- **Vite major** — check `vite.config.ts` for deprecated plugin APIs (the build uses rolldown options and a `codeSplitting` group for mapbox-gl); check `@vitejs/plugin-react` compatibility
- **React major** — check for removed APIs; this project uses React 19 (hooks, no class components except `AppErrorBoundary`)
- **Tailwind CSS major** — check the config format (v4 uses CSS-based config, not `tailwind.config.js`)
- **TypeScript major** — check the four `tsconfig.*.json` project files for removed/changed compiler options; run `npx tsc -b --noEmit` after
- **ESLint major** — check the `eslint.config.js` flat config format; check plugin compatibility
- **@supabase/supabase-js major** — check RLS/client API changes; see `src/lib/supabase.ts` (note the `auth.experimental.passkey` opt-in used by the admin panel)
- **mapbox-gl major** — check layer paint/layout expression syntax; see `src/lib/mapLayers.ts`
- **react-router-dom major** — check the route definition API; see `src/App.tsx`
- **@cloudflare/workers-types major** — affects `functions/` and `tsconfig.functions.json`

### 6. Fix lint and type errors

After any update, run:

```bash
npm run lint
npx tsc -b --noEmit
```

`tsc -b` is required — `tsconfig.json` is a solution config with project references only. Fix errors before proceeding; `noUnusedLocals` and `noUnusedParameters` are enforced.

### 7. Verify build and tests

```bash
npm test                 # unit tests
npm run test:functions   # Deno tests for the edge functions (needs deno on PATH)
npm run build            # production build (must succeed cleanly)
npm run test:e2e         # Playwright; runs build:e2e first
```

All of them must pass before the branch is ready.

### 8. Report

Summarize:

- Packages updated (old version → new version)
- Breaking changes applied and how they were resolved
- Any packages skipped (with reason)
- Test results

## Verification baseline (as of 2026-08-10)

All green on this project before any dependency changes:

- `npm test`: 86 test files, 631 tests pass in ~25 s
- `npm run build`: succeeds cleanly (a mapbox-gl chunk size warning is expected and harmless)
- `npm run test:e2e`: 50 tests across 8 spec files in ~2.6 min; the run includes a production build first

Refresh these numbers when they drift — a stale baseline is worse than none.

## Gotchas

- **Mapbox API errors in the e2e WebServer log** — expected; the e2e build uses `e2e-mapbox-token` intentionally. Tests still pass.
- **Tailwind v4 has no `tailwind.config.js`** — the config lives in CSS (`@theme` directive). Don't create a config file.
- **TypeScript uses a tilde range (`~6.0.x`)** — `tsconfig` `target`/`lib` values may change between patch releases; check `tsc --version` after an upgrade.
- **`npm outdated` exits with code 1** when anything is outdated — that is normal, not an error. Use `|| true` in scripts.
- **E2E runs against a preview server on port 4174** (`PLAYWRIGHT_PORT` overrides it) — kill a stale `vite preview` on that port before running, or set a different port.
- **`wrangler` is intentionally absent from devDependencies** — don't "helpfully" add it; it pulls ~40–50 MB of workerd binaries for one CI command.

## Troubleshooting

- **`EADDRINUSE` on port 4174 or 5173**: `pkill -f vite` then retry
- **`tsc` errors after an upgrade**: run `npx tsc -b --noEmit 2>&1 | head -50` to see all errors; fix before building
- **E2E fails after a dep update**: check whether `playwright.config.ts` needs updating; run `npx playwright install chromium` on a browser version mismatch
- **`npm install` peer dependency conflict**: use `--legacy-peer-deps` only as a last resort; prefer finding compatible versions first
