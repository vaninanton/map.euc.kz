---
name: update-bike-paths
description: Update the Almaty bike lanes (src/data/almaty.json) — a full rebuild from OpenStreetMap via Overpass. Use when asked to check or update the bike lanes on the map, when the owner reports a lane that is split, wrongly joined, missing or extra, or periodically (every few months) as maintenance.
---

# Skill: updating the Almaty bike lanes

**OpenStreetMap is the source** (since 2026-09-25). velojol.kz, the previous source,
went dark: its `.kz` domain is in `serverHold` at the registry (the owner is a private
person in Russia; the hosting has no A record either). The owner decided the hand-written
velojol descriptions and surface ratings are not worth waiting for — nobody read them.

## How to update

```bash
node scripts/fetch-osm-bike-lanes.js
```

One Overpass request (bike ways in the Almaty bbox + named roads within 35 m of them, for
naming), then the pipeline below, then a **full rewrite** of `src/data/almaty.json` with a
summary: ways → lines after each merge stage, what was dropped and why, names by source,
warnings. Reference point on 2026-09-25: 2600 Overpass objects → 440 bike ways → 115
lanes, 110.8 km.

- `overpass-api.de` often answers 504 under load; the script retries it 3 times with a
  30 s pause and only then falls back to `overpass.private.coffee`. **That mirror returned
  a truncated answer once** (842 objects instead of 2600, almost no roads for naming), so
  the script refuses to write the file when more than 25 % of pieces end up unnamed or
  fewer than 50 lanes come out.
- Every run is non-deterministic only through OSM edits: on the same Overpass answer the
  output is byte-identical. When changing rules, save one answer and diff the output before
  and after (see "Changing rules" below).

## The pipeline (`buildSegments`)

Each stage exists because of a concrete case the owner reported; the case is named in
the code comment next to each constant. Do not "simplify" a stage away without re-checking
its case.

1. **Classify** (`classifyWay`). Keep `highway=cycleway` (separated, or shared when
   `foot=designated|yes` without `segregated=yes`) and roads with
   `cycleway*=lane|opposite_lane|shoulder` (lane) or `track|opposite_track` (separated).
   Skip: crossings (`cycleway|footway=crossing`), `cycleway=separate` (drawn elsewhere —
   would duplicate along the road axis), `shared_lane`/`share_busway`, `XCO` mountain
   trails, ways under construction (owner's decision: only rideable lanes), and
   `HIDDEN_WAY_IDS`. Deduplicate by id: a named road with a lane comes twice in the
   answer (as a bike way and as a naming road) — that once doubled every lane.
2. **Manual merges** (`MERGE_GROUPS`) — see below.
3. **Duplicate lanes** (`isDuplicateLane`): a road lane ≥ 50 m with ≥ 80 % of its length
   within 15 m of a separate cycleway is dropped — the separate line has the real
   geometry, the lane is drawn on the road axis (улица Богенбай Батыра, 912358838).
4. **Duplicate ways** (`dropDuplicateWays`): a way lying ≥ 90 % within 2 m of another.
5. **Spurs** (`pruneSpurs`): a way < 20 m growing out of a junction (3+ ways) with a free
   other end — it creates a fake fork (Манаса × Абая, 1355938166). A short *last* piece
   before a gap is not a spur (removing it widened the Тимирязева gap from 37 to 49 m).
6. **Bypasses** (`dropBypasses`, also after merging): a line ≤ 100 m whose both ends lie
   on another line and which never leaves it by more than 15 m — bus-stop loops on
   Макатаева. Running it before merging matters: the loop 1422516696 created fake forks
   on Сейфуллина.
7. **Names** (`osmName`, `inferName`): `name:ru` → `name` → the street the way runs along
   (≥ 60 % of samples within 35 m) → «Велодорожка». The merge key is the lowercased name
   (OSM has «Богенбай батыра» next to «Богенбай Батыра»); lane type does **not** split a
   line (30 m of shared path inside a separated lane on Жандосова).
8. **Name adoption** (`adoptNeighbourNames`): a piece with a weaker name (rank: OSM >
   inferred > none, then length) takes its neighbour's name at a fork-free shared point.
   Inferred names are only given up by pieces ≤ 150 m (the BAK bridge); longer ones stay,
   otherwise street corners swap names (Саина → «вдоль БАКа», Тимирязева → «Жарокова»).
9. **Merge by shared points** (`mergeByNodes`): two pieces join when they end at the same
   coordinate (not OSM node id — the BAK bridge has its own nodes at the same spot), share
   the key, and **no other bike way passes through that point** (fork detection counts all
   ways, not just same-name ones — otherwise Райымбека turned back on itself). Сатпаева
   west: 45 road pieces → one line.
10. **Straight-name adoption** (`adoptAlongStraight`), then merge by points again: a merged
    line with an inferred name takes the neighbour line's name when the lane continues
    straight — turn ≤ 35° measured **250 m** from the joint. Closer measurement lies: at
    50 m the Утепова/Кекилбайулы corner looked straight (0°), at 250 m it is 57°; Абая →
    Нурпеисова is 1°. The name's strength travels with it, which guarantees termination.
11. **Turnaround rings** (`attachRings`): a closed loop ≤ 600 m attached to the one line
    ending on it (Торайгырова).
12. **Hook trimming** (`trimHooks`): a free end curling ≥ 60° over its last ≤ 30 m (towards
    a crossing) is cut before gap merging, otherwise its heading points sideways
    (Утепова, 1415138779).
13. **Merge across gaps** (`mergeAcrossGaps`) — bike lanes break at every intersection
    because crossings are skipped. Two ends join when all hold:
    - same key, or one of the lines is unnamed (it continues the named one — Рыскулова);
    - gap ≤ 40 m with turn and bridge angle ≤ 35°, or gap ≤ 100 m strictly straight (≤ 15°)
      with sidestep ≤ 10 m (Тимирязева 84 m; Манаса lane→sidewalk 8 m sidestep; Жумабаева
      13 m sidestep is the other side of the street and must stay rejected);
    - gaps < 10 m skip the bridge-direction check (park ring ends pass side by side, 8 m);
    - each end is the other's clear best by `distance + 3 × sidestep`, next candidate ≥ 10
      worse (Гоголя: both sides of the street meet at one intersection).
    Headings are measured over the last 50 m (20 m made curbs look like 40° turns).
14. **Bypasses again, then lines < 20 m are dropped** (5–10 m stubs at intersections).

The output id of a line is the smallest OSM way id in it; type, name and description are
those covering most of the length (the name only among the most reliable parts).

## Owner's manual lists (top of the script)

- **`HIDDEN_WAY_IDS`** — OSM way ids not shown although mapped. Each entry has a comment
  with the reason and date (238779261: riding is banned in the First President's Park).
  If an id disappears from OSM, the summary warns — remove it then.
- **`MERGE_GROUPS`** — ordered OSM way ids of one lane where the general rules cannot help
  (real forks that are one path, e.g. a loop with an entrance). Each piece is flipped to
  continue the chain; the group becomes one way before all stages. Warnings: id missing
  (gone, hidden or not a bike way), id repeated, gap > 60 m.

The owner reports problems by **segment id** (what the deep link shows). To act on it,
find which OSM ways form that segment (match segment coordinates against way geometry in
a saved Overpass answer) and check the junction: how many ways end there, names, turn
angles, gap and sidestep. Most reports so far were fixed by a general rule; reach for the
manual lists only when a rule would misfire elsewhere.

## Changing rules

1. Save one Overpass answer to the scratchpad and build a "golden" output from it
   (`buildSegments(elements)`).
2. Change the rule, rebuild on the same answer and list which segments disappeared or
   appeared. Every change outside the reported case must be explained or reverted.
3. Check overlaps: length of lines lying within 3 m of another line and self-overlap
   inside lines. Both are near zero today; growth means a bad join.
4. Add a unit test named after the case, then run the full gate.

A temporary dev-only "previous / next lane" navigator (`BikeLaneReviewNav`, removed
before the 2026-09 PR) was handy for walking all lanes with the owner; rebuild it the
same way if a full review is needed again (`import.meta.env.DEV` + `lazy`, so it never
reaches the production bundle).

## Important pitfalls

- **Never merge by end proximity alone.** The first OSM build (July 2026, PRs
  #176/#177/#179) chained pieces whose ends were within 60 m: lines jumped to the other
  side of the street and back, unnamed pieces chained into 10 km zigzags across the city,
  lanes drew over each other. Every gap rule above exists to prevent that.
- **Never serialize `almaty.json` with `JSON.stringify(data, null, 2)`** — it puts every
  number on its own line and the diff explodes (PR #176). The script's `serialize()` keeps
  `[lon, lat]` pairs on one line; the file is in `.prettierignore`.
- **Deep links change with merges.** `/m/bikelane/:id` uses the smallest OSM way id of the
  line; OSM edits or rule changes can change it. Known trade-off, no workaround.
- **Street names are genitive surnames** — «улица Тимирязева», «проспект Рыскулова»; never
  decline them as feminine in messages to the owner.
- Run the full gate before committing: `npm run lint`, `npm run format:check`,
  `npx tsc -b --noEmit`, `npm test`, `npm run build`, `npm run test:e2e`.

## History

- Until 2026-07-29: velojol.kz JSON endpoint. 2026-07-29/30: a first OSM build (see the
  pitfall above), then velojol's `window.bikelanesData` on the city page. 2026-09-25:
  velojol's domain is on hold; this OSM pipeline replaced it. The velojol script is in git
  history (`git show e8efd69:scripts/fetch-velojol-bike-lanes.js`), the first OSM script
  too (`git show 67e71c0^:scripts/rebuild-bike-paths.js`).

## Ship it as a PR

Follow [[git-feature-workflow]] (`.claude/skills/git-feature-workflow/SKILL.md`): branch
`feature/update-bike-lanes-<date>` → commit → push → `gh pr create`.

Commit message: `feat(map): обновить велодорожки Алматы из OpenStreetMap`.

In the PR body, include the summary numbers from the script output and, if lanes appeared
or disappeared, which ones.
