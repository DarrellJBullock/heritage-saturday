# Heritage Saturday — Product Spec

## Capability 1: Roster Import + Basic Game Simulation

This is the first shippable capability of Heritage Saturday, an original-fiction American
football league simulator (see company-docs/vision.md for full product vision). It is a
vertical slice of MVP 1: prove that a user can import a roster, set up a game between two
teams, and get a deterministic, plain-text box score. Later capabilities (documented
separately) will extend this slice to cover league templates, bands, rivalries, headshots,
commissioner tooling, seasons/standings, and the MVP 2 broadcast presentation layer.

### Problem Statement
Today there is no product. A user with a spreadsheet of fictional players and teams has no
way to bring that roster into Heritage Saturday, no way to line two teams up against each
other, and no way to see what happened. Capability 1 closes that gap with the smallest loop
that is genuinely useful and testable end to end: **import → set up game → view box score.**

### Goal
Ship a working core loop that Engineering can build against and Tester can verify without
further product clarification, and that later capabilities (bands, rivalries, templates,
broadcast presentation, seasons) can be layered on top of without rework.

---

### In Scope

**A. Roster Import**
- Upload a workbook (CSV, JSON, XLSX, or XLS) containing at minimum a **Players** sheet and
  a **Teams** sheet (per vision's required columns — see Data Entities below).
- Downloadable blank template for the supported formats.
- Preview step before commit: shows parsed rows, row-level validation errors/warnings,
  and a created/updated/skipped/failed summary count.
- Reject malformed files, empty required fields, duplicate player/team IDs, duplicate
  jersey numbers on the same team, invalid positions, out-of-range ratings.
- Commit step creates a Roster (with Teams and Players) owned by the importing user,
  **visibility = PRIVATE by default** (no sharing/promotion UI needed yet — see Out of
  Scope).
- Import history: user can see prior imports and their summaries.
- Coaches, Headshots, Bands, Rivalries, and DepthChart sheets: if present in the workbook,
  parse and store Coaches/DepthChart data if valid (needed for game setup); Headshots,
  Bands, and Rivalries sheets are accepted without error but their data is not surfaced or
  used anywhere in this capability (silently stored or ignored — Architect's call).

**B. Game Setup**
- A setup flow where the user picks two teams from their own imported roster(s).
- Depth chart: auto-generate starters/backups from player overall_rating + position if no
  valid DepthChart was imported or the imported one is incomplete; user can view but manual
  editing is optional/stretch, not required for this capability's "done."
- Playbook: user assigns one offensive archetype and one defensive archetype per team from
  the fixed original-fiction archetype lists in the vision (Balanced, Power Run, Spread,
  Vertical Passing, West Coast, Option/RPO, Play Action Heavy / Balanced 4-3, Base 3-4,
  Nickel Zone, Blitz Heavy, Man Coverage, Bend-Don't-Break, Run Stop). A sensible default
  (e.g., "Balanced" / "Balanced 4-3") is pre-selected so the user can proceed with one click.
- User triggers "Run Game" for a single, standalone game (not part of a season/schedule).

**C. Simulation → Text Box Score**
- Deterministic engine run: given the two teams, rosters, depth charts, playbooks, and a
  random seed, produces one final result every time for that seed.
- Default configuration: 4 quarters, standard downs/distance, standard scoring
  (TD/FG/XP/safety/punts/turnovers). Overtime uses a single default format. No weather,
  no penalties, no injuries, no fatigue, no home-field advantage toggle in this capability
  — engine may compute them, but they are off/not configurable in the game-setup UI (see
  Out of Scope).
- Output presented as **plain text only** (no PixiJS presentation, no animation, no audio,
  no live/animated viewer): final score, quarter-by-quarter scoring line, and a simple
  per-team and per-player stat line (passing/rushing/receiving/defense/kicking basics).
- Box score is saved and retrievable later at a stable URL/route.

---

### Out of Scope (deferred to later capabilities)
- League templates, 8/16/24/54-team presets, league-from-template generation.
- Marching bands, band profiles, band spotlight, crowd atmosphere/audio.
- Rivalries, classic games, homecoming, protected-rival scheduling.
- Headshot upload/ZIP/mapping, headshot display anywhere.
- Commissioner roles/permissions beyond "owner can do everything to their own roster."
  Multi-user roles (Owner/Commissioner/Team Manager/Viewer) are not needed since rosters
  are private and single-user in this slice.
- Roster visibility promotion (PRIVATE → LEAGUE), sharing, cloning, LEAGUE-scoped access.
- Roster archive/restore/delete flows (import history exists, but delete/archive UX is a
  later capability — for now, assume rosters simply persist).
- Manual depth-chart editing UI (auto-generated depth chart is sufficient for "done";
  manual edit is a nice-to-have, not required for acceptance).
- Play-by-play text, live/animated game viewer, start/pause/speed controls, replay.
- Commentary templates, crowd audio, presentation timeline, scorebug.
- Standings, schedule, multi-game seasons, win-loss records across games.
- Two-point conversions, penalties, injuries, weather, fatigue, home-field advantage
  (engine may internally model any of these, but none are user-configurable or guaranteed
  present in output for this capability).
- Team color validation/branding, team pages, player profile pages as standalone screens
  (a player's stats appear in the box score; a dedicated player-profile page is not
  required here).

---

### User Stories & Acceptance Criteria

**Story 1 — Import a roster**
As a user, I want to upload a spreadsheet of my fictional teams and players so that I can
use them in a game.

1. Given a valid CSV/JSON/XLSX/XLS file with required Players and Teams sheets/data, when
   I upload it, then I see a preview listing every team and player row with a per-row
   status of OK, WARNING, or ERROR before anything is committed.
2. Given a file missing a required column (e.g., `position` on Players, `team_name` on
   Teams), when I upload it, then the affected rows are flagged ERROR with a specific
   message naming the missing/invalid field, and I cannot commit those rows.
3. Given a file with a duplicate `player_id` or a duplicate jersey number within the same
   `team_id`, when I preview it, then those rows are flagged ERROR and excluded from
   commit unless I first fix and re-upload.
4. Given a file with an out-of-range rating (e.g., overall_rating outside a defined 0–99
   scale) or an invalid position code (not in the vision's fixed position list), when I
   preview it, then those rows are flagged ERROR.
5. Given a preview with only valid or WARNING rows, when I click "Commit Import," then a
   Roster is created containing all valid Teams and Players, and I see an import summary
   with counts of created/updated/skipped/failed.
6. Given a completed import, the resulting Roster's visibility is PRIVATE and only visible
   to me; no other user can see or query it.
7. Given a file with an unsupported extension or corrupt/unparseable content, when I
   upload it, then I see a clear top-level error and no partial import occurs.
8. Given a completed import, I can find it later in an import history list showing
   file name, date, and the created/updated/skipped/failed summary.
9. A downloadable blank template (matching the required columns) is available from the
   import screen for at least one supported format.

*ACs 10–15 added after Sprint 1 to make the WARNING row status reachable. Prior to this,
`ImportRowStatus` declared OK|WARNING|ERROR but no validation rule ever emitted WARNING,
so AC5 above described a state the system could not produce. Existing AC numbering is
left untouched deliberately, since test cases already reference it.*

*An **orphan row** is a row whose non-blank reference (`team_id`, or `player_id` on the
DepthChart sheet) points at an entity that will not exist after commit. Commit silently
drops such rows — it never fails the FK and never aborts. ACs 10–14 govern Players; AC15
extends the identical rule to Coaches and DepthChart.*

10. Given a Players row whose `team_id` is non-blank but matches no committable Teams row
    in the same import, when I preview the import, then that row is flagged WARNING with
    a message naming the `team_id` and stating the player will not be created until a
    matching team is added. It is not flagged ERROR: the row's own data is valid, and the
    fix belongs on the Teams sheet.
11. Given a Players row with a *blank* `team_id`, when I preview it, then it is flagged
    ERROR ("Missing required field: team_id"), never WARNING. ERROR always outranks
    WARNING on the same row.
12. Given a preview containing one or more WARNING orphan-player rows, when I click
    "Commit Import," then: (a) the commit succeeds and creates the Roster, Teams, and all
    linked Players normally; (b) the orphan rows are not created as Player records;
    (c) the summary's `created` count excludes them; (d) the summary's `skipped` count
    includes them; (e) the summary's `failed` count excludes them — they were valid but
    unlinked, not rejected.
13. Given a Teams row that is itself ERROR (e.g. missing `team_name`, or a duplicate
    `team_id`), a Players row referencing that same `team_id` is flagged WARNING, since
    that team will also not be committed.
14. Given an import with no orphan players, the `created`/`skipped`/`failed` counts are
    unchanged from prior behavior.
15. The orphan rule applies identically to the Coaches and DepthChart sheets:
    (a) a Coaches row whose `team_id` matches no committable Teams row is WARNING and is
    counted as `skipped`, not `created`;
    (b) a DepthChart row whose `team_id` matches no committable Teams row is WARNING;
    (c) a DepthChart row whose `player_id` matches no player that this import will
    actually create — including a player who is himself an orphan, or whose row is
    ERROR — is WARNING, because that entry cannot be written either;
    (d) when a DepthChart row is orphaned by both its team and its player, the message
    names the team, since that is the root cause;
    (e) a DepthChart row dropped only because its team's chart is incomplete remains OK
    (see Open Questions #8c) — that is auto-generation fallback, not a broken reference —
    but it is still counted as `skipped`, because it was not written.
16. The summary's four counts are expressed in one unit: **entity rows**. Every entity row
    falls in exactly one of `created` (written), `skipped` (valid but not written) or
    `failed` (ERROR), so `created + skipped + failed` equals the entity row count. In
    particular `created` counts individual DepthChart *entries*, not whole charts.
    Row *status* (OK/WARNING/ERROR) and summary *bucket* are distinct: an OK row may be
    skipped, as in AC15(e).
17. A team's depth chart is judged complete against only those rows that will actually be
    written — i.e. after rows referencing an uncommittable team or player are removed.
    Given a chart in which every required starting position appears, but the row covering
    one of them references a player the import will not create, then no chart is persisted
    for that team; all of its DepthChart rows are `skipped` and the team falls back to
    auto-generation. A partial chart missing a required starting position is never written:
    it would be immediately regenerated on first read, so persisting it is a lie.

**Story 2 — Set up a game**
As a user, I want to pick two of my imported teams and quickly configure a game so I can
run a simulation.

1. Given I have at least two teams across my committed roster(s), when I open game setup,
   then I can select exactly two different teams (I cannot select the same team twice).
2. Given two teams are selected, when the setup screen loads, then a depth chart is shown
   for each team, auto-generated from player ratings by position, with every required
   starting position (per the vision's fixed position list) filled if the roster has
   enough eligible players; if a position cannot be filled (not enough players), I see a
   clear warning naming the unfilled position(s) but can still proceed only if the engine
   can run a legal game (e.g., minimum viable lineup) — otherwise "Run Game" is disabled
   with an explanation.
3. Given two teams are selected, when the setup screen loads, then each team has a default
   offensive and defensive archetype pre-selected, and I can change each team's archetype
   independently from the fixed original-fiction archetype lists.
4. Given valid team selections, depth charts, and archetypes, when I click "Run Game,"
   then the simulation executes and I am taken to a result screen without further input
   required (no manual play-calling at any point).
5. Given the same two teams, depth charts, archetypes, and an explicitly re-used seed,
   when I run the game twice, then the final score and full stat line are identical both
   times (determinism).

**Story 3 — View the text box score**
As a user, I want to see what happened in the game in a simple, readable text summary.

1. Given a completed simulation, when I view the result, then I see the final score with
   team names and final point totals, unambiguously indicating the winner (or a tie if the
   ruleset allows it).
2. Given a completed simulation, when I view the result, then I see a quarter-by-quarter
   scoring line (points scored by each team in Q1–Q4, plus OT if applicable) that sums to
   the final score.
3. Given a completed simulation, when I view the result, then I see a team stat line for
   each team including at minimum: total yards, passing yards, rushing yards, turnovers,
   and time of possession (or an equivalent minimal set if time of possession is not yet
   modeled — see Open Questions).
4. Given a completed simulation, when I view the result, then I see a per-player stat line
   for any player with a non-zero relevant statistic (e.g., a QB with passing attempts, a
   RB with carries, a WR with receptions), grouped by team.
5. Given a completed simulation, the box score is persisted and reloading its URL/route
   later returns the same result without re-running the simulation.
6. The box score view is plain text/simple HTML — no animation, no audio, no PixiJS
   overlays, no scorebug, in this capability.

---

### Primary User Flow (end to end)

1. User navigates to Roster Import → uploads CSV/JSON/XLSX/XLS.
2. System parses file → shows Preview screen with row-level validation (OK/WARNING/ERROR).
3. User reviews preview, fixes/re-uploads if needed, clicks Commit.
4. System shows Import Summary (created/updated/skipped/failed) → Roster is saved,
   PRIVATE, owned by the user.
5. User navigates to Game Setup → selects Team A and Team B from their roster(s).
6. System auto-generates a depth chart for each team; user optionally reviews; user
   confirms/changes each team's offensive and defensive archetype (defaults pre-filled).
7. User clicks "Run Game."
8. System runs the deterministic simulation engine (teams + rosters + depth charts +
   playbooks + seed) synchronously or via a background job, then redirects to the result.
9. User views the Text Box Score: final score, quarter-by-quarter line, team stats,
   per-player stats.
10. Box score is retrievable again later from a stable link/route.

---

### Success Metrics (for this slice)
- **Loop completion rate:** % of users who start a roster import and reach a viewed box
  score in the same session ≥ 80% in internal/dogfood testing (blockers = bugs, not UX
  friction, at this stage).
- **Import correctness:** 100% of intentionally-malformed test fixtures (missing columns,
  duplicate IDs, bad ratings, invalid positions) are caught pre-commit with zero false
  negatives (no bad row is silently committed) in the QA suite.
- **Determinism:** 100% of repeated-seed simulation runs produce byte-identical box score
  output in the QA suite (0 flaky/non-deterministic results).
- **Time to first box score:** a new user with a prepared valid fixture file can go from
  upload to box score in under 2 minutes without external help (usability smoke test).
- **Zero brand-safety violations:** 0 instances of real player/team/school/league names,
  logos, or branded terminology anywhere in sample data, templates, or UI copy shipped
  with this capability (Legal/IP Safety sign-off required before ship).

---

### Data Entities Touched (subset of vision's full entity list)
- **Roster** — the committed container; owner, visibility (PRIVATE only, in this slice).
- **RosterImport / RosterImportRow** — the upload → preview → commit audit trail,
  including per-row validation status.
- **Team** — fields per vision's Teams sheet; only identity fields are required for this
  slice (color/branding fields may be stored if present but are unused by any screen here).
- **Player** — fields per vision's Players sheet, including archetype and the full rating
  set needed by depth-chart generation and the simulation engine.
- **Coach** — parsed if present; not required for the engine in this slice (playbook
  archetype is assigned directly at game setup, independent of Coach data).
- **DepthChart** — per-team, per-position starter/backup assignments; auto-generated if
  not imported or incomplete.
- **Playbook** — the fixed offensive/defensive archetype selected per team for a given
  game (not a user-authored playbook in this slice — selection from a fixed list only).
- **Game** — one standalone simulated game: two teams, seed, ruleset defaults, status,
  result reference.
- **GameEvent** — internal engine output (drives/scoring events); consumed to build the
  quarter-by-quarter line, not exposed as its own screen/route in this slice.
- **TeamGameStats** — one row per team per game, feeding the team stat line.
- **PlayerGameStats** — one row per player-with-activity per game, feeding the per-player
  stat line.

Entities explicitly NOT touched in this slice: LeagueMember, RosterPermission,
RosterVersion, Band, Stadium (beyond a name field, if present), HeadshotAsset, Schedule,
Standing, LeagueRule (beyond engine defaults), Rivalry, ClassicGame, HomecomingGame,
CommentaryTemplate, AudioEvent, UserAudioSetting.

---

### Release / Sprint Outline

**Sprint 1 — Import foundation**
- File parser (CSV/JSON/XLSX/XLS) for Players + Teams sheets.
- Validation rules (required fields, duplicates, rating ranges, position enum).
- Preview UI + row-status rendering.
- Commit → Roster/Team/Player persistence, PRIVATE visibility.
- Import summary + import history list.
- Downloadable template (at least CSV).

**Sprint 2 — Game setup**
- Team-picker UI scoped to the user's own rosters.
- Depth-chart auto-generation service (rating-based, position-aware).
- Playbook archetype selection UI with defaults.
- "Run Game" trigger wired to a stubbed/engine-ready Game record.

**Sprint 3 — Simulation engine (v0) + box score**
- Deterministic engine v0: seeded RNG, basic drive/play resolution sufficient to produce
  a legal final score, quarter splits, and team/player stat accumulation for the stat
  categories listed in acceptance criteria.
- TeamGameStats / PlayerGameStats persistence.
- Text box score view + stable route + reload-without-rerun behavior.

**Sprint 4 — Hardening & QA**
- Fixture-based QA suite: malformed-file cases, duplicate/rating/position validation
  cases, determinism repeat-seed tests, incomplete-roster/unfillable-position edge cases.
- Legal/IP Safety pass on all sample data/templates/UI copy shipped with this capability.
- Bug bash against the full end-to-end flow and success metrics above.

---

### Open Questions / Assumptions
Per the vision's global constraint ("ask no questions — make reasonable assumptions"),
the following assumptions are recorded rather than blocking:

1. **Minimum viable roster size** — assumed a team needs enough players to fill one
   starter per required offensive/defensive position (no full backup requirement) to be
   eligible for "Run Game"; exact minimum count is an Architect/Engineering call within
   that constraint.
2. **Overtime format** — assumed a single fixed default (e.g., one OT period, next-score
   or possession-based) with no user configuration in this slice; exact rule is an
   Architect call, not exposed in game setup UI.
3. **Time of possession** — assumed the engine can approximate this from play/drive
   timing; if Architect/Engineering determines it's not feasible in the v0 engine, it may
   be dropped from the team stat line for this slice without re-spec, since it's not the
   core proof point (score + basic stats are).
4. **Synchronous vs. background job** — assumed a single game simulation is fast enough
   to run synchronously or with a short spinner; BullMQ worker usage for this specific
   slice is an Architect implementation choice, not a product requirement (the vision
   reserves worker usage primarily for "long games"/multi-game runs, which are out of
   scope here).
5. **Multiple rosters per user** — assumed a user may have imported more than one roster
   file over time, and game setup lets them pick teams across all of their own committed
   rosters (not restricted to a single most-recent import).
6. **Tie handling** — assumed the default ruleset allows a tie only if OT is exhausted per
   the fixed default format; if the chosen OT format guarantees a winner, ties never occur
   in this slice.
7. **Non-required sheets present in the uploaded workbook** (Coaches, Headshots, Bands,
   Rivalries) — assumed safe to parse-and-store-if-valid or silently ignore, per Brand
   Safety and to avoid scope creep; they must never block or fail an otherwise-valid
   Players/Teams import.
8. **What earns WARNING** (decided post-Sprint 1; see Story 1 ACs 10–15) — exactly one
   *kind* of rule: the orphan row, applied to Players, Coaches, and DepthChart. Every rule
   enumerated in ACs 2–4 is ERROR by the spec's own language ("cannot commit those rows",
   "excluded from commit"), so none of them could be downgraded without letting malformed
   data into a committed Player. The orphan case is the only one where the row is
   structurally valid but cannot land, for a reason external to itself.
   **Deliberately excluded:** (a) any commit-path change that would make an orphan row
   actually land (auto-creating a placeholder Team is a data-model decision Product has not
   asked for); (b) range checks on optional secondary attributes (`speed`, `aggression`, …),
   which are nullable, unconstrained, and unread by the Cap-1 engine — flagging them would
   be noise, not signal; (c) reclassifying the *incomplete depth chart* case, where a team's
   rows are dropped because the chart lacks a required starting position. That is the
   intentional fall back to auto-generation (architecture.md §5), not a failed reference,
   so those rows keep status OK and are never flagged WARNING. They are, however, counted
   as `skipped` in the summary (AC16), since they are not written — status and summary
   bucket are deliberately different concepts.
