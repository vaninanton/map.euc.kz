---
name: update-deps
description: Update npm dependencies for map.euc.kz. Use when asked to update packages, check outdated dependencies, bump versions, upgrade npm deps, or run npm-check-updates. Handles minor/patch updates automatically and major updates with breaking-change analysis and confirmation.
---

Update npm dependencies for map.euc.kz. The workflow creates a new git branch, classifies each outdated package as minor/patch vs major, applies safe updates immediately, researches breaking changes for major bumps, then verifies with build + tests before reporting.

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

- **Vite major** — check `vite.config.ts` for deprecated plugin APIs; check `@vitejs/plugin-react` compatibility
- **React major** — check for removed APIs; this project uses React 19 (hooks, no class components)
- **Tailwind CSS major** — check config format (v4 uses CSS-based config, not `tailwind.config.js`)
- **TypeScript major** — check `tsconfig.json` for removed/changed compiler options; run `tsc --noEmit` after
- **ESLint major** — check `eslint.config.ts` flat config format; check plugin compatibility
- **@supabase/supabase-js major** — check RLS/client API changes; see `src/lib/supabase.ts`
- **mapbox-gl major** — check layer paint/layout expression syntax; see `src/lib/mapLayers.ts`
- **react-router-dom major** — check route definition API; see `src/App.tsx` or equivalent router setup

### 6. Fix TypeScript errors

After any update, run:
```bash
npm run lint
npx tsc --noEmit
```

Fix errors before proceeding — `noUnusedLocals` and `noUnusedParameters` are enforced.

### 7. Verify build and tests

```bash
# Unit tests (99 tests, ~500ms)
npm run test

# Production build (must succeed cleanly)
npm run build

# E2e tests (15 tests, ~8s) — requires no other server on port 5180
PLAYWRIGHT_PORT=5180 npm run test:e2e
```

All three must pass before the branch is ready.

### 8. Report

Summarize:
- Packages updated (old version → new version)
- Breaking changes applied and how they were resolved
- Any packages skipped (with reason)
- Test results

## Verification baseline (as of 2026-06-11)

All green on this project before any dependency changes:
- `npm run test`: 21 test files, 99 tests pass in ~500ms
- `npm run build`: succeeds in ~400ms (mapbox-gl chunk size warning is expected and harmless)
- `npm run test:e2e`: 15 tests pass in ~8s (Mapbox API errors in WebServer log are expected — e2e uses a fake token)

## Gotchas

- **`module.register()` deprecation warning** — appears on every npm/node invocation with Node 26. Not a build error; ignore it.
- **Mapbox API errors in e2e WebServer log** — expected; e2e config uses `e2e-mapbox-token` intentionally. Tests still pass.
- **Tailwind v4 has no `tailwind.config.js`** — config lives in CSS (`@theme` directive). Don't create a config file.
- **TypeScript ~6.x uses tilde range** — `tsconfig` `target`/`lib` values may change between patch releases; check `tsc --version` after upgrade.
- **`npm outdated` exits with code 1** if any packages are outdated — this is normal, not an error. Use `|| true` in scripts.
- **E2e tests spawn their own dev server** — kill any running `vite` process before running e2e, or use a different port with `PLAYWRIGHT_PORT`.

## Troubleshooting

- **`EADDRINUSE` on port 5173 or 5180**: `pkill -f vite` then retry
- **`tsc` errors after upgrade**: run `npx tsc --noEmit 2>&1 | head -50` to see all errors; fix before running build
- **E2e tests fail after dep update**: check if `playwright.config.ts` needs updating; run `npx playwright install chromium` if browser version mismatch
- **`npm install` peer dependency conflict**: use `--legacy-peer-deps` only as last resort; prefer finding compatible versions first
