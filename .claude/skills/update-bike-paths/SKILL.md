---
name: update-bike-paths
description: Update the Almaty bike lanes (src/data/almaty.json) — a full rebuild from velojol.kz. Use when asked to check or update the bike lanes on the map, or periodically (every few months) as maintenance.
---

# Skill: updating the Almaty bike lanes

**velojol.kz is the source of truth** (owner's decision, 2026-07-30). Its dataset is
hand-curated: real descriptions ("cars park on this bike lane"), lane type and a
surface rating — none of which exist in OSM or anywhere else.

## How to update

```bash
node scripts/fetch-velojol-bike-lanes.js
```

The script downloads `https://velojol.kz/city/almaty`, extracts the
`window.bikelanesData` array out of the HTML, filters and cleans it, and **fully
rewrites** `src/data/almaty.json`, printing a summary (segments, km, breakdown by
lane type, how many records were filtered out).

Reference point on 2026-07-30: 578 records on the page → 245 segments / 107.1 km in
the file, ~160 KB.

What it does along the way:

- **velojol has no data endpoint.** The old `velojol.kz/static/data/cities/almaty.json`
  has returned 404 since 2026-07-29 (the site is alive, the endpoint is gone). The only
  access to the dataset is the inline script on the city page. If the script fails with
  "В HTML нет window.bikelanesData", inspect the page markup by hand — they may have
  moved to an API.
- **Bus lanes are dropped.** `is_bus_lane: true` is roughly half of the velojol dataset
  (327 of 578), with auto-generated names like «Автобусная полоса №7463» and no
  descriptions. Owner's decision (2026-07-30): the "Велодорожки" layer on the EUC map is
  cycling infrastructure only. If they ever need to be shown, that is a separate layer
  with its own color and toggle — not a merge into the existing one.
- **Individually hidden lanes live in `HIDDEN_IDS`** at the top of the script. The owner
  asked to remove specific velojol objects from the map (2026-07-30: First President's
  Park, two pieces of Zheltoksan Park, Seifullin square, Chekhov, Moldagaliev). The
  filter lives in the script rather than at runtime so a data refresh cannot bring them
  back. To restore a lane, remove its id and re-run the script; to hide a new one, add
  its id with the name in a comment. If the script prints "id из HIDDEN_IDS нет в
  датасете velojol", velojol deleted or renumbered the object and the id should be
  dropped from the list.
- **Names are fixed at build time.** velojol has a single `title` field with no language
  variants (there is no `title_ru`/`title_kk` in the dataset) and users type it in — hence
  some streets are in Kazakh and the formatting is inconsistent. The script (1) translates
  through the `NAME_ALIASES` dictionary (11 names / 20 segments as of 2026-07-30), and
  (2) normalizes to «улица X» / «проспект X», otherwise «Абая проспект», «Проспект Абая»
  and «проспект Абая» look like three different streets in a list. The summary prints
  "названий на казахском без перевода" and "алиасы не пригодились" — those lines are how
  the dictionary gets extended. The logic is covered by tests
  (`scripts/fetch-velojol-bike-lanes.test.js`), including the case where it once silently
  failed: in JS `\b` treats only ASCII as a word boundary, so a regexp with `\b` does not
  match Cyrillic — which is why normalization is done word by word.
- **Fragments of one lane are merged via `MERGE_GROUPS`.** velojol sometimes stores one
  lane as several pieces (2026-07-30: улица Манаса — `2031` + `1014` + `362` + `58`,
  0.86 km; Роща Баума — 11 unnamed pieces, 6.18 km). The id order within a group is the
  order along the lane; a piece is reversed automatically if it was drawn backwards. The
  first id becomes the id of the merged lane — deep links to the other pieces stop
  working. Lane type, description and rating come from the first piece (the script warns
  when types differ), the length is the sum. A gap over 60 m between pieces raises a
  warning: the map would draw a straight line across it, meaning the group is wrong.
- **Extra fields are stripped**: the author with their avatar, `edit_url`/`can_edit`,
  `city*`, `photos`/`videos`, `created_at`, `color` (layer colors come from `COLORS`) and
  `overall_quality` (a second, "overall" rating that gets confused with surface quality).
  Coordinates are rounded to 6 decimals (≈0.1 m) — the source has 14 digits of junk
  precision. Without this cleanup the file is 1 MB instead of 164 KB.
- **Sorted by id.** velojol returns records in edit order, which made every diff reshuffle
  the whole file.

## How to find duplicates

On velojol the same path is often traced by two authors: a long named segment with
unnamed pieces drawn on top of it. Such duplicates go into `HIDDEN_IDS` (keep the named
one).

The metric: the share of a segment's length lying within a 25 m corridor of another one,
**plus the median distance between the two traces** over that stretch. The median is
mandatory: without it, lanes running in opposite directions along the same street get
classified as duplicates — their overlap is 100 % but the median is 8–25 m (the width of
the roadway). Calibration on 2026-07-30: true duplicates have a median of 0.1–5.5 m;
улица Гоголя (`128` and `313`, two sides) sits at 20.4 m; улица Жумбаева and Палладина
are 1 m apart and are duplicates.

The 2026-07-30 review is closed: the owner walked through all 18 groups and hid 19 traces
(see `HIDDEN_IDS`, each annotated «поверх ‹id›»). Decisions that do not follow from the
metric and must not be "corrected" back:

- `226` was **kept** even though it partially (52 %) lies on `2014` "along the BAK" — it
  extends beyond 2014 and cannot be trimmed;
- `64` «улица Утепова» and `1015` were **kept** — they only landed in the Zharokov group
  through a 20-meter stub at the corner; they are neighbors, not duplicates;
- `198` «улица Жарокова» was **hidden** in favor of `2002` (the same stretch, but 198 has
  an outdated lane type) — the only case where a named segment was hidden;
- `437` and `258` remain the "owners" of their groups even though their names are
  placeholders — there is simply no other candidate in the group.

For a repeat review it helps to build a triage page (SVG geometry previews, checkboxes, a
prompt generator) — write the generator in the scratchpad, do not commit it.

## How to find new merge groups

A one-off reconnaissance script (not in the repository — write it in the scratchpad):
compute pairwise distances between segment endpoints, build connected components with a
~30 m threshold, and sort them into four buckets:

1. **one name, pieces connect** — the most reliable candidates;
2. **a named piece plus unnamed «Велодорожка №N» pieces** — the улица Манаса case;
3. **only unnamed pieces** — mergeable, but you will have to invent a name;
4. **pieces with different names that connect** — those are intersections, do NOT merge
   (downtown this links the whole grid of bollard-separated lanes: 35 pieces, 13.8 km).

Always compute vertex degree: if a piece has more than two neighbors it is an intersection
or a loop, not a link in a chain — such a component cannot be merged into one line and
needs manual review. The 30 m threshold was chosen empirically: real joins in velojol are
almost always 0–15 m.

## Known dataset compromises

These are not script bugs — do not try to "fix" them; they are the quality of the source
data:

- **Names mix Russian and Kazakh** — exactly as velojol users typed them («Саин көшесі»,
  «Бөгенбай Батыр көшесі»). 157 of 251 segments are placeholders like «Велодорожка №1026».
- **Coarse geometry on some segments** — 40 are drawn with two points (e.g. «улица
  Наурызбай Батыра» — a 2.76 km straight line cutting through blocks).
- **Stubs** — 37 segments shorter than 50 m. Not filtered: the dataset is hand-made, trust
  the author.
- **Duplicate names** — 7 records named «Бөгенбай Батыр көшесі» and similar. Those are
  different pieces of one street, not duplicates. Do not merge them: in PR #176 an attempt
  to detect duplicates by name deleted genuinely parallel lanes (`alm30` / `alm109`, two
  distinct lanes on Satpayev).

## Important pitfalls

- **Never serialize `almaty.json` with `JSON.stringify(data, null, 2)` or
  `json.dump(..., indent=2)` directly.** The file stores coordinate pairs `[lon, lat]` on
  one line; generic indented serialization expands every number onto its own line, which
  reformats the entire file and produces a diff of tens of thousands of lines instead of
  the real change (this happened in PR #176). `scripts/fetch-velojol-bike-lanes.js` has
  its own `serialize()` — use it. The file is in `.prettierignore` for the same reason.
- **Bike lane ids come from velojol** (numeric, e.g. `7589`) and end up in the
  `/m/bikelane/7589` deep link. If velojol renumbers its objects, old links break — a known
  risk with no workaround.
- **Do not push to one branch in installments if the PR might merge before you finish.**
  In PR #177 some commits landed on an already-merged branch and became dead weight — they
  had to be resurrected in a new PR (#179). If the work spans several sessions, either warn
  that the PR is not final or hold off opening it until the whole change set is ready.
- After a rebuild, run the full gate before committing: `npm run lint`,
  `npm run format:check`, `npx tsc -b --noEmit`, `npm test`, `npm run build`,
  `npm run test:e2e` (the last one may need `npx playwright install chromium` if Playwright
  was just updated by a dependency bump — otherwise the tests fail with "Executable doesn't
  exist", which has nothing to do with the bike lanes).

## History: why not OSM

Between 2026-07-29 and 2026-07-30 the source was OpenStreetMap (`src/data/almaty.json`,
`scripts/rebuild-bike-paths.js`, PRs #176/#177/#179) — precisely because the velojol data
endpoint had died and the dataset looked lost. Once `window.bikelanesData` was found, the
OSM pipeline was deleted: velojol has hand-written descriptions and ratings, while the OSM
build produced generic «Загружено из OpenStreetMap» descriptions and placeholder names
carrying OSM way ids. If velojol dies again, the OSM build code is in git history
(`git show 3491bdf:scripts/rebuild-bike-paths.js`).

## Ship it as a PR

From here, follow the repository's standard flow — see
[[git-feature-workflow]] (`.claude/skills/git-feature-workflow/SKILL.md`):
branch `feature/update-bike-lanes-<date>` → commit → push → `gh pr create`.

Commit message: `feat(map): обновить велодорожки Алматы из velojol.kz`.

In the PR body, include the final numbers from the script output (segments, km, breakdown
by type, how many bus lanes were filtered out) and, if the count changed, what exactly
appeared or disappeared.
