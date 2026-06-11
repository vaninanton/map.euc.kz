---
name: git-feature-workflow
description: Create a feature branch, commit changes, push, and merge to main via GitHub PR. Use when asked to create a branch, open a PR, merge to main, or complete the full git feature workflow for map.euc.kz.
---

Standard feature branch workflow for map.euc.kz: branch from `main` → commit → push → open PR on GitHub → merge. Remote is `git@github.com:vaninanton/map.euc.kz.git`. Merges land as merge commits (not squash).

## 1. Create branch

```bash
git checkout main
git pull
git checkout -b feature/<name>
```

Branch naming: `feature/<what>`, `fix/<what>`, `deps/<what>`. Keep it short and lowercase with dashes.

## 2. Make changes, then commit

Stage specific files (never `git add -A` — risks committing `.env.local`):

```bash
git add src/components/Foo.tsx src/hooks/useBar.ts
git commit -m "short imperative description"
```

Commit message style from this repo: lowercase imperative, no period. Examples: `add radar range toggle`, `fix point form validation`, `update mapbox layer paint`.

If pre-commit hooks run (ESLint / tsc), fix any errors before retrying the commit. Never use `--no-verify`.

## 3. Push

```bash
git push -u origin feature/<name>
```

## 4. Open PR

```bash
gh pr create --title "Short title" --body "$(cat <<'EOF'
## Summary
- What changed and why

## Test plan
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] Manually verified in browser
EOF
)"
```

The command prints the PR URL — share it with the user.

## 5. Merge

After review/CI passes:

```bash
gh pr merge <PR-number> --merge --delete-branch
```

`--merge` keeps the merge commit (matches existing repo history). `--delete-branch` cleans up the remote branch.

Then sync local main:

```bash
git checkout main
git pull
```

## One-liner: full flow for a simple change

```bash
# 1. branch
git checkout main && git pull && git checkout -b feature/my-change

# 2. ... make changes ...

# 3. commit + push
git add <files>
git commit -m "describe the change"
git push -u origin feature/my-change

# 4. open PR
gh pr create --title "Describe the change" --body "## Summary
- One-line why"

# 5. merge (after CI)
gh pr merge --merge --delete-branch
git checkout main && git pull
```

## Gotchas

- **`git push` asks for passphrase** — remote uses SSH (`git@github.com`). SSH key must be added to the agent: `ssh-add ~/.ssh/id_ed25519` (or equivalent).
- **CI runs on push** — `.github/workflows/deploy.yml` deploys on merge to `main`. Don't merge if the build is broken.
- **`--no-verify` is forbidden** — if lint/tsc hooks fail, fix the underlying issue first.
- **`npm run lint` uses ESLint flat config** — `eslint.config.ts`, not `.eslintrc`. Don't add `.eslintignore`.
- **Untracked `.claude/skills/`** — the skills directory is not yet committed. If you're committing it as part of a feature, add it explicitly: `git add .claude/skills/`.
