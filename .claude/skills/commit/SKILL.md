---
name: commit
description: Prepare and create a git commit for map.euc.kz with lint/type/test gates, test-coverage review and docs freshness check. Use when the user says "коммит", "сделай коммит", "commit", "/commit".
---

# Skill: /commit

Follow the steps in order. Do not skip steps and do not batch unrelated checks.
All user-facing output (commit messages, CHANGELOG entries, questions to the user) stays in **Russian** — that is the repo convention.

## Step 1. Run the checks

Run these in order, each only after the previous one is green:

```bash
npm run lint
npm run format:check
npx tsc -b --noEmit
npm test
```

If `supabase/functions/` changed, also run (requires deno on PATH — `~/.deno/bin`):

```bash
npm run test:functions
```

`tsc -b` is required: `tsconfig.json` is a solution config with `references` only.
`format:check` is part of the pre-commit hook — skipping it here just moves the failure to commit time; `npm run format` fixes it.

If any command fails:

- Show the error to the user
- Fix it (lint — `npx eslint --fix` where possible; tsc/test — analyze and patch the code)
- Re-run the failed command
- Only when everything is green, continue to Step 2

**Never use `--no-verify` and never skip a check.**

Note: the pre-commit hook additionally runs `npm run build` and `npm run test:e2e`. E2E is the slow part — if the change touches UI selectors, run `npx playwright test tests/e2e/<file>.e2e.ts` for the affected spec before committing rather than discovering it inside the hook.

## Step 2. Check test coverage

Review the changed files:

- If `.ts`/`.tsx` files with logic were added or changed (components, hooks, utils, API), check whether matching `*.test.ts`/`*.test.tsx` files exist among the changes or in the project.
- If tests are missing or do not cover the new behavior — **ask the user**:
    > «Для следующих файлов не найдены тесты: `<список>`. Написать unit-тесты? Также нужны e2e-тесты (Playwright)?»
- If the user says yes — write the tests, then return to Step 3.
- If the user says no — continue.

> Exceptions (no tests needed): configs (`vite.config.ts`, `eslint.config.js`, `playwright.config.ts`), DB migrations, static data (`*.json`), types without logic, router-only pages.

Also remember: a new frontend query to Supabase needs a mock in `tests/e2e/fixtures.ts`, otherwise e2e will fail.

## Step 2.5. Check documentation freshness

`docs/` is the canonical source and is updated **in the same commit** as the code. Map changed files to the relevant document:

| Changed                                                  | Check / update                                       |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `supabase/migrations/`                                   | `docs/database.md` (tables, RLS, buckets, RPC)       |
| `supabase/functions/telegram-location-bot/`              | `docs/telegram-bot.md` (routes, secrets)             |
| `supabase/functions/ai-assist/`                          | `docs/admin.md` (section «ИИ-помощник»)              |
| `src/App.tsx`, `src/utils/hashNav.ts`, `eventLinks.ts`   | `docs/frontend.md` (route table)                     |
| `src/hooks/`, `src/components/`, `src/lib/`, `constants` | `docs/frontend.md` (inventory)                       |
| events/news (`useEvents`, `event*`, `news*`)             | `docs/events-news.md`                                |
| `src/admin/`                                             | `docs/admin.md` (routes, adminApi)                   |
| `functions/` (Cloudflare Pages Functions)                | `docs/deployment.md` (OG tags, sitemap, entity dump) |
| `.github/workflows/`, `.env.example`, `vite.config.ts`   | `docs/deployment.md`                                 |
| `tests/e2e/`, vitest config, `.husky/`                   | `docs/testing.md`                                    |
| new invariants / development rules                       | `AGENTS.md`, `CLAUDE.md` (both, kept in sync)        |

If behavior changed but the relevant document did not: update the document and include it in this commit. If the change does not touch documented behavior, continue without asking.

## Step 3. Compose the commit message

Inspect:

```bash
git diff --cached
git log --oneline -5
```

Commit message rules for this repo:

- Format: `type(scope): описание на русском`
- Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`, `ci`
- Scope (optional): `admin`, `map`, `api`, `auth`, `og`, `seo`, `e2e`, `deps`
- Description: short, imperative, no trailing period
- Examples:
    - `feat(admin): drag & drop и лайтбокс в PhotoManager`
    - `fix(map): поднять контролы над таб-баром`
    - `test(admin): покрытие PhotoManager тестами`

Show the proposed commit message to the user and ask for confirmation (or offer to edit it).

## Step 4. Update CHANGELOG.md

For notable changes, prepend an entry to `CHANGELOG.md` (below the `# Changelog` heading), matching the existing format. **The changelog is written in Russian** and headings carry a date only — no version numbers, no `[Unreleased]` marker:

```markdown
## YYYY-MM-DD (краткая тема)

### Added / Changed / Fixed

- Краткое описание изменения
```

The theme in parentheses is optional and used to tell apart several entries with the same date.

Dependency bumps and pure refactors without user-visible effect do not need an entry.
Show the user the entry before writing the file.

## Step 5. Git commit

Stage only the files you changed (never `git add -A` — it risks committing `.env.local`):

```bash
git add <specific files>
```

Create the commit:

```bash
git commit -m "$(cat <<'EOF'
<commit message>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

Use the model name of the current session in the `Co-Authored-By` trailer.

If the pre-commit hook fails, fix the problem and create a **new commit** (not `--amend`).

After a successful commit, show `git log --oneline -1`.

## Step 6. Push and Pull Request

Ask the user:

> «Коммит создан. Запушить изменения и открыть Pull Request?»

**If yes:**

```bash
git push -u origin <branch>
```

If the branch is `main`, warn first: **«Вы пушите прямо в `main` — это триггерит деплой в прод. Уверены?»** and wait for confirmation.

Then ask: **«Создать Pull Request на GitHub?»**

If yes:

```bash
gh pr create \
  --title "<commit message without the Co-Authored trailer>" \
  --body "$(cat <<'EOF'
## Summary
<bullet list of changes, from the CHANGELOG entry>

## Test plan
- [ ] `npm run lint` — ✅
- [ ] `npx tsc -b --noEmit` — ✅
- [ ] `npm test` — ✅
- [ ] `npm run test:e2e` — ✅
- [ ] Проверено в браузере

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the **PR link** to the user.

**If no** — stop and report that the commit exists locally.

---

## Quick reference

| Step | Action                                                        |
| ---- | ------------------------------------------------------------- |
| 1    | lint → format:check → tsc -b → test (+ test:functions) — fix failures |
| 2    | Review test coverage, offer to write missing tests            |
| 2.5  | Update `docs/` affected by the change                         |
| 3    | Compose commit message + confirm with the user                |
| 4    | Update `CHANGELOG.md`                                         |
| 5    | `git add <files>` + `git commit`                              |
| 6    | Ask about push and PR                                         |
