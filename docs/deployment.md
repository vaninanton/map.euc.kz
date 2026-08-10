# Deployment, CI/CD and environment

## Hosting

- **Frontend**: Cloudflare Pages, project `map-euc` (technical address `map-euc.pages.dev`), custom domain `map.euc.kz`. The build runs in GitHub Actions and the finished `dist/` is uploaded with `wrangler pages deploy` (direct upload). Vite builds with `base = /` — the site lives at the domain root. SPA routing comes from `public/_redirects` (`/* /index.html 200`) and cache headers from `public/_headers`; Vite copies both files into `dist/` verbatim.
- **Backend**: hosted Supabase (PostgreSQL 17, Storage, Edge Functions).
- **Locally**: Valet proxies `map.euc.test` → `localhost:5173`; allowed dev hosts are `map.euc.test` and `test.euc.kz`.

## Workflows

### `deploy.yml` — push to `main` / manual

1. **supabase**: link via `SUPABASE_PROJECT_REF` → `supabase db push` (migrations) → `supabase functions deploy telegram-location-bot --no-verify-jwt --use-api` and the same for `ai-assist`.
2. **deploy**: `npm run build` (Vite only — types were checked on the PR) with the `VITE_*` values from repository variables → `wrangler pages deploy dist --project-name=map-euc --branch=main` via `cloudflare/wrangler-action@v3`.
3. **notify** (`if: always()`): reports the result to Telegram, linking to the specific deployment from `deployment-url`.

The two jobs are independent and run in parallel, so total wall clock is `max(supabase, deploy)` rather than the sum.

Edge function secrets (`TELEGRAM_BOT_TOKEN` and friends) are **not** set in CI — they are configured once with `supabase secrets set` (see [telegram-bot.md](telegram-bot.md)).

### Cloudflare Pages

- **CI token** (`CLOUDFLARE_API_TOKEN`): `Account → Cloudflare Pages → Edit` is enough. One-off domain and DNS work needs a separate token with `Zone → DNS → Edit` and `Zone → Zone → Read` on the `euc.kz` zone — there is no reason to keep that one in CI.
- **Manual deploy**: `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler@4 pages deploy dist --project-name=map-euc --branch=main`. The branch must be `main` — only a production deployment reaches the custom domain.
- **Rollback**: `npx wrangler@4 pages deployment list --project-name=map-euc`, then "Rollback to this deployment" in the dashboard. DNS is untouched.
- **Why not Cloudflare's Git integration**: the build would move to CF, where `GITHUB_SHA` does not exist (the PWA cache version is derived from it), seven `VITE_*` variables would have to be duplicated in the dashboard, and the `supabase` job would stay in Actions anyway — the pipeline would split in two.
- **Preview deployments are disabled**: they would build with the production `VITE_SUPABASE_*`, meaning the admin panel in a preview would write to the production database. Enable them only together with an isolated Supabase project.
- **`wrangler` is deliberately not in devDependencies**: it pulls the workerd platform binaries (~40–50 MB) onto every developer's machine for the sake of one CI command.

### Pages Functions (dynamic OG tags and sitemap)

The `functions/` directory sits at the repository root; wrangler compiles it during deploy (`wrangler pages functions build` does the same locally) and generates `_routes.json` itself.

- `functions/m/[type]/[id].ts` — rewrites `<title>` and the OG/twitter tags for links such as `/m/point/11`, `/m/route/5`, `/m/bikelane/62`. The page stays the same SPA bundle: `next()` returns `index.html` and `HTMLRewriter` only patches the tags in `<head>`.
- **`_routes.json` covers only `/m/*`** — assets, `/`, `/events/*` and the admin panel bypass the worker and do not consume its invocations.
- `functions/sitemap.xml.ts` — the sitemap: static sections plus every point, route, bike lane and event. It is built from the same dump, so a point created in the admin panel appears in `sitemap.xml` without a deploy. It is linked from `public/robots.txt`.
- Data sources: points and routes come from an **hourly dump** of the whole Supabase REST payload (23 KB for 108 entities; RLS filters hidden rows out on its own), bike lanes come from the static `src/data/almaty.json` bundled into the function. No meta is built for riders (`/m/telegramuser/…`) — that is personal data.
- The dump is cached for an hour, misses for 5 minutes. An entity missing from the dump (just created) is fetched individually. The cache is per data center and can be evicted at any time, so "once an hour" really means "when the first request in this data center finds the dump stale".
- The Supabase request has a 2.5 s timeout; on a timeout or a missing entity the default markup is served — the page never breaks.
- **A point photo goes into the preview as-is, with no size check** (project owner's decision, August 2026). Telegram — the priority parser — accepts up to 5 MB and compresses on its own; WhatsApp sometimes shows no preview at all for images heavier than ~600 KB, leaving the card without a picture. Supabase Storage transformations (`/storage/v1/render/image/...`) return 403 on the current plan, so there is nothing to downscale with — if this ever matters, the fix is either compressing on upload in the admin panel or generating map screenshot previews.
- **The function's environment variables** are set in the Pages project (Settings → Environment variables), not in GitHub: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. The values match `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the anon key is public anyway, hence plain text.

Local verification, on the same runtime as production:

```bash
npm run build
npx wrangler@4 pages dev dist --port 8788 \
  --binding SUPABASE_URL="$VITE_SUPABASE_URL" --binding SUPABASE_ANON_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"
curl -s http://localhost:8788/m/point/11 | grep -oE '<meta property="og:[^"]*" content="[^"]*"'
```

Note that `functions/` is bundled by esbuild, which does not understand the `@/` alias — imports from `src/` must be relative.

### `test.yml` — pull requests and push to `main`

`paths-ignore`: `**/*.md`, LICENSE, `.editorconfig`, `.gitignore`, `.vscode/**`. Jobs: `checks` (lint, format:check, tsc, vitest, deno) and `e2e` (Playwright chromium) in parallel; `notify` on failure.

### `backup.yml` — daily at 03:00 UTC (≈08:00 Almaty) / manual

1. **Database**: installs `postgresql-client-17` on the runner (the server runs PG 17), runs `pg_dump --schema-only` and `--data-only` with `--exclude-schema` for every Supabase system schema, gzips the result and checks the size is over 1 KB.
2. **Storage**: `aws s3 sync` of the four buckets (`map-point-photos`, `telegram-avatars`, `map-event-photos`, `map-news-photos`) through the Supabase Storage S3 protocol.
3. **Upload**: to Selectel S3 (`BACKUP_S3_*`) with `--no-verify-ssl` — the Russian CA certificate is absent from the runner's trust store.

Restores and manual dumps are handled by the `supabase-backup` skill.

## Environment variables (frontend)

`cp .env.example .env.local`:

| Variable                            | Purpose                               | Default |
| ----------------------------------- | ------------------------------------- | ------- |
| `VITE_MAPBOX_TOKEN`                 | Mapbox public token                   | —       |
| `VITE_SUPABASE_URL`                 | Supabase project URL                  | —       |
| `VITE_SUPABASE_PUBLISHABLE_KEY`     | Anon key (RLS-protected)              | —       |
| `VITE_YANDEX_METRIKA_ID`            | Metrika counter (optional)            | empty   |
| `VITE_TELEGRAM_GEO_TTL_MINUTES`     | How many minutes to show geolocations | 60      |
| `VITE_TELEGRAM_TRACK_TAIL_MINUTES`  | Length of the track "tail"            | 30      |
| `VITE_TELEGRAM_MAX_ACCURACY_METERS` | Maximum GPS error                     | 100     |

**When adding a variable, sync it in five places**: `.github/workflows/deploy.yml`, `.env.example`, `.env.local`, `README.md`, and `build:e2e` in `package.json` (the e2e production build needs it). `tests/config/deployConfig.test.ts` guards the parity.

Sync commands: sensitive → `gh secret set NAME --body "$NAME"`, non-sensitive → `gh variable set NAME --body "$NAME"` (templates `.env.github_vars` / `.env.github_secrets`, both gitignored).

## GitHub Variables / Secrets

**Variables**: `SUPABASE_PROJECT_REF`, every `VITE_*` from the table above, `SUPABASE_STORAGE_S3_ENDPOINT/REGION`, `BACKUP_S3_BUCKET/REGION/ENDPOINT`.

**Secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (CI notifications — a separate instance, not to be confused with the edge function secret), `SUPABASE_STORAGE_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `BACKUP_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

`CLOUDFLARE_*` is CI-only and the "sync in five places" rule does not apply to it: these are not build variables and are needed neither in `.env.example` nor in `build:e2e`. The account id lives in Secrets rather than Variables because the repository is public.

## Build versioning

`__APP_VERSION__` = `GITHUB_SHA` (or `Date.now()` locally) — it reaches the SW registration (`sw.js?v=...`) and the cache names, so every deploy invalidates the PWA cache. This is exactly why the build stays in GitHub Actions: `GITHUB_SHA` does not exist on the Cloudflare side.

## Post-deploy checklist

```bash
BASE=https://map.euc.kz
# Every route must be 200 text/html (SPA fallback from _redirects)
for p in / /radar /events /m/point/1 /help /admin /no-such-page; do
  printf '%-16s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' $BASE$p)"
done
curl -sI $BASE/assets/…js | grep -i cache-control   # immutable
curl -sI $BASE/sw.js      | grep -i cache-control   # no-cache
```

If `sw.js` is suddenly served with `max-age=14400` instead of `no-cache`, the zone has a fixed **Browser Cache TTL** enabled, which overrides origin headers for files with a cacheable extension. Fix it by setting the zone to `browser_cache_ttl = 0` ("Respect Existing Headers"); otherwise PWA updates reach users delayed by that TTL.

The technical address `map-euc.pages.dev` serves the same production build and is **not** canonicalized: in `_redirects` the source must be a path, and rules with a full URL are ignored silently. Only a Pages Function matching on hostname could redirect it to `map.euc.kz`.

Separately, on a device with the PWA installed: the service worker update should arrive, Cache Storage should contain only caches carrying the new sha, and an offline navigation to a previously unvisited path should serve the app shell without the `a redirected response was used…` console error.

## Local Supabase

```bash
supabase start    # Docker: API 54321, DB 54322, Studio 54323
supabase status   # keys for .env.local
supabase db reset # apply migrations + seed
supabase functions serve telegram-location-bot
supabase stop
```

Cloud preview branches require a paid plan — use the local stack for bot, migration and RLS work. The `supabase-clone-prod` skill refreshes the local stack with production data.
