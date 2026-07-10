# Heritage Saturday — Architecture: Capability 1
## Roster Import + Basic Game Simulation

Scope: this document covers ONLY Capability 1 as defined in `company-docs/product-spec.md`.
Stack, monorepo layout, and full entity/route lists are inherited from `company-docs/vision.md`
and are not re-litigated here. Anything the spec marks out-of-scope (bands, rivalries,
headshots, commissioner roles, seasons/standings, broadcast presentation) is deliberately
absent from this design; section 9 notes where those attach later.

Example data in this doc (e.g., "Ridgeline Ramblers," "Cobalt Crest Coyotes") is 100%
original fiction, per the brand-safety rule.

---

## 1. Overview & Component Map

Three sub-flows, same monorepo, same stack (`apps/web` Next.js, `apps/api` NestJS/Prisma/Postgres,
`apps/worker` BullMQ, shared `packages/*`).

```
apps/web (Next.js)
  ├─ /imports, /imports/new, /imports/:id/preview        (Import flow UI)
  ├─ /games/new                                          (Game Setup UI)
  └─ /games/:id/box-score                                (Box Score UI)
        │
        ▼  fetch/axios via typed client (packages/shared)
apps/api (NestJS)
  ├─ ImportsModule  ──uses──> packages/importers, packages/validation
  ├─ RostersModule, TeamsModule, PlayersModule, CoachesModule
  ├─ DepthChartsModule
  ├─ GamesModule    ──uses──> packages/simulation-engine
  └─ Prisma (PostgreSQL)
        │
        ▼ (optional path, see §6)
apps/worker (BullMQ) ──uses──> packages/simulation-engine  (same pure engine, no duplication)
```

### Flow A — Import
`web (upload form)` → `POST /imports/roster` (multipart) → `ImportsModule` parses file via
`packages/importers`, runs `packages/validation` rules, writes `RosterImport` +
`RosterImportRow[]` (status PENDING) → responds with import id → `web` calls
`GET /imports/:id/preview` to render rows → user clicks Commit → `POST /imports/:id/commit`
→ `ImportsModule` runs one Prisma transaction creating `Roster`/`Team`/`Player`/`Coach`/
`DepthChart` from valid rows → returns summary.

### Flow B — Game Setup
`web (team picker)` → `GET /rosters`, `GET /teams?rosterId=` (ownership-scoped) →
`GET /depth-charts/:teamId` (auto-generates on first read if none/incomplete, via
`DepthChartsModule`) → user selects archetypes (client-side only, no persistence until
Run Game) → `POST /games/simulate` with both team ids, depth chart snapshot, archetype
selections, optional seed.

### Flow C — Simulate → Box Score
`GamesModule` validates inputs, creates a `Game` row (status RUNNING), invokes
`packages/simulation-engine` synchronously (see §6 for the sync-vs-worker decision) →
writes `GameEvent`, `TeamGameStats`, `PlayerGameStats`, sets `Game.status = COMPLETE` →
returns `gameId` → `web` redirects to `/games/:id/box-score` → `GET /games/:id/box-score`
reads persisted rows only, never re-simulates.

---

## 2. Monorepo Package/Module Breakdown

### `apps/api` NestJS modules (Capability 1 subset)

| Module | Owns | Must NOT know about |
|---|---|---|
| **ImportsModule** | `RosterImport`, `RosterImportRow` lifecycle (upload→preview→commit); orchestrates parser + validator; the transactional commit that writes Roster/Team/Player/Coach/DepthChart | Simulation, depth-chart *generation* algorithm (only writes imported depth charts if valid) |
| **RostersModule** | `Roster` CRUD (read + create-via-import only in this slice), ownership checks, visibility enforcement (PRIVATE only) | File parsing, simulation |
| **TeamsModule** | `Team` read (scoped to caller's rosters); exposes team lookups for game setup | Player rating math, engine internals |
| **PlayersModule** | `Player` read (scoped via team → roster ownership) | Depth chart assignment logic (consumes it, doesn't own it) |
| **CoachesModule** | `Coach` read/write during import commit only | Playbook selection (spec: archetype is chosen independently of Coach) |
| **DepthChartsModule** | `DepthChart` read + auto-generation service (rating/position based); "is this depth chart legal to run a game" check | Playbooks, simulation, stats |
| **GamesModule** | `Game`, `GameEvent`, `TeamGameStats`, `PlayerGameStats` persistence; orchestrates calling `packages/simulation-engine`; box-score read endpoint | HOW the engine computes plays — only calls it as a black box |
| **AuthModule / OwnershipGuard** (cross-cutting, not new for Cap 1 but required) | Attaches `userId` to request; a shared guard/interceptor enforcing "resource belongs to caller" on Rosters/Teams/Players/DepthCharts/Games | Business rules of each module |

### `packages/*` (library packages, framework-agnostic where possible)

| Package | Responsibility | Boundary |
|---|---|---|
| **`packages/importers`** | Format-agnostic parsers: CSV, JSON, XLSX, XLS → common intermediate row shape (`{ sheet: 'players'|'teams'|'coaches'|'depthchart'|'headshots'|'bands'|'rivalries', rowIndex, raw: Record<string,unknown> }[]`) | No DB access, no validation rules, no Nest dependency — pure parse function per format, callable from `apps/api` |
| **`packages/validation`** | Zod (or class-validator) schemas for Players/Teams/Coaches/DepthChart rows; cross-row rules (duplicate player_id, duplicate jersey per team, rating range, position enum); returns `{status: OK|WARNING|ERROR, messages[]}` per row | Shared between `apps/web` (client-side pre-check / template generation) and `apps/api` (server-side source of truth) — web never trusts its own validation for commit decisions |
| **`packages/simulation-engine`** | Pure, deterministic simulation function (see §6) | Zero DB, zero HTTP, zero Nest/Next imports — importable by `apps/api`, `apps/worker`, and test suites identically |
| **`packages/shared`** | Cross-cutting TypeScript types: `Position` enum, `PlaybookArchetype` enums, `ImportRowStatus`, DTO interfaces shared between web/api, error shape | No logic, types/constants only |

---

## 3. Data Model / Schema Design (Prisma, Capability-1 subset)

Only entities the spec lists as "touched." `User` included for ownership only (assume Auth
already exists at the platform level; not re-designed here).

```prisma
enum Visibility {
  PRIVATE
  // LEAGUE, SHARED_LINK, PUBLIC_TEMPLATE reserved for later capabilities — not used yet
}

enum ImportRowStatus {
  OK
  WARNING
  ERROR
}

enum ImportStatus {
  PENDING     // uploaded, parsed, not yet committed
  COMMITTED
  FAILED      // top-level parse failure, no rows created
}

enum Position {
  QB RB FB WR TE LT LG C RG RT LE RE DT LOLB MLB ROLB CB FS SS K P KR PR
}

enum OffensiveArchetype {
  BALANCED POWER_RUN SPREAD VERTICAL_PASSING WEST_COAST OPTION_RPO PLAY_ACTION_HEAVY
}

enum DefensiveArchetype {
  BALANCED_4_3 BASE_3_4 NICKEL_ZONE BLITZ_HEAVY MAN_COVERAGE BEND_DONT_BREAK RUN_STOP
}

enum GameStatus {
  PENDING     // created, not yet run (not really used since Cap 1 runs immediately)
  RUNNING
  COMPLETE
  FAILED
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())

  rosters   Roster[]
  imports   RosterImport[]
  games     Game[]
}

model RosterImport {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  fileName     String
  fileFormat   String        // csv | json | xlsx | xls
  status       ImportStatus  @default(PENDING)
  createdCount Int           @default(0)
  updatedCount Int           @default(0)
  skippedCount Int           @default(0)
  failedCount  Int           @default(0)
  topLevelError String?      // set if file was corrupt/unparseable
  createdAt    DateTime      @default(now())
  committedAt  DateTime?

  rows         RosterImportRow[]
  roster       Roster?       // set once committed

  @@index([userId, createdAt])
}

model RosterImportRow {
  id             String          @id @default(cuid())
  importId       String
  import         RosterImport    @relation(fields: [importId], references: [id])
  sheet          String          // players | teams | coaches | depthchart | headshots | bands | rivalries
  rowIndex       Int
  rawData        Json            // original parsed row, for audit/debug
  status         ImportRowStatus
  messages       String[]        // human-readable validation messages
  entityRefId    String?         // player_id/team_id/coach_id as given in the sheet, for dup-checking

  @@index([importId, sheet, status])
}

model Roster {
  id         String     @id @default(cuid())
  ownerId    String
  owner      User       @relation(fields: [ownerId], references: [id])
  name       String
  visibility Visibility @default(PRIVATE)
  sourceImportId String? @unique
  sourceImport   RosterImport? @relation(fields: [sourceImportId], references: [id])
  createdAt  DateTime   @default(now())

  teams      Team[]

  @@index([ownerId])
}

model Team {
  id           String   @id @default(cuid())
  rosterId     String
  roster       Roster   @relation(fields: [rosterId], references: [id])
  externalTeamId String  // team_id from the sheet, unique within a roster
  teamName     String
  abbreviation String?
  city         String?
  state        String?
  conference   String?
  division     String?
  coachName    String?  // denormalized display field; Coach entity is separate
  // color/branding fields stored but unused by any Cap-1 screen
  primaryColor String?
  secondaryColor String?

  players      Player[]
  coach        Coach?
  depthChart   DepthChart[]
  homeGames    Game[]   @relation("HomeTeam")
  awayGames    Game[]   @relation("AwayTeam")

  @@unique([rosterId, externalTeamId])
  @@index([rosterId])
}

model Player {
  id             String   @id @default(cuid())
  teamId         String
  team           Team     @relation(fields: [teamId], references: [id])
  externalPlayerId String // player_id from sheet, unique within roster
  firstName      String
  lastName       String
  position       Position
  jerseyNumber   Int
  archetype      String?
  overallRating  Int      // 0-99
  speed Int? strength Int? awareness Int?
  throwPower Int? throwAccuracy Int?
  catching Int? routeRunning Int?
  carry Int? trucking Int?
  passBlock Int? runBlock Int?
  tackle Int? coverage Int?
  kickPower Int? kickAccuracy Int?
  // headshot fields stored if present, unused in Cap 1
  headshotUrl String? headshotFileName String? portraitPath String?

  depthChartEntries DepthChartEntry[]
  gameStats      PlayerGameStats[]

  @@unique([teamId, externalPlayerId])
  @@unique([teamId, jerseyNumber])
  @@index([teamId, position])
}

model Coach {
  id           String @id @default(cuid())
  teamId       String @unique
  team         Team   @relation(fields: [teamId], references: [id])
  externalCoachId String
  firstName    String
  lastName     String
  offensiveStyle String?
  defensiveStyle String?
  aggression Int? discipline Int? development Int? gameManagement Int?
}

model DepthChart {
  id        String   @id @default(cuid())
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  source    String   // IMPORTED | AUTO_GENERATED
  generatedAt DateTime @default(now())

  entries   DepthChartEntry[]

  @@index([teamId])
}

model DepthChartEntry {
  id           String     @id @default(cuid())
  depthChartId String
  depthChart   DepthChart @relation(fields: [depthChartId], references: [id])
  position     Position
  slot         Int        // 0 = starter, 1..3 = backups
  playerId     String
  player       Player     @relation(fields: [playerId], references: [id])

  @@unique([depthChartId, position, slot])
}

model Game {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  homeTeamId  String
  homeTeam    Team     @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeamId  String
  awayTeam    Team     @relation("AwayTeam", fields: [awayTeamId], references: [id])
  homeOffArchetype OffensiveArchetype
  homeDefArchetype DefensiveArchetype
  awayOffArchetype OffensiveArchetype
  awayDefArchetype DefensiveArchetype
  seed        String   // string so it can be user-supplied or generated (e.g. uuid/int as string)
  rulesetVersion String @default("v0")
  status      GameStatus @default(PENDING)
  homeScore   Int?
  awayScore   Int?
  createdAt   DateTime @default(now())
  completedAt DateTime?

  events      GameEvent[]
  teamStats   TeamGameStats[]
  playerStats PlayerGameStats[]

  @@index([ownerId, createdAt])
}

model GameEvent {
  id        String   @id @default(cuid())
  gameId    String
  game      Game     @relation(fields: [gameId], references: [id])
  quarter   Int      // 1-4, 5 = OT
  sequence  Int      // order within the game
  type      String   // SCORE | TURNOVER | PUNT | DRIVE_END | ... (engine-defined, not a fixed enum yet)
  teamId    String?
  payload   Json     // engine-specific detail, not directly rendered in Cap 1 UI

  @@unique([gameId, sequence])
  @@index([gameId, quarter])
}

model TeamGameStats {
  id            String @id @default(cuid())
  gameId        String
  game          Game   @relation(fields: [gameId], references: [id])
  teamId        String
  team          Team   @relation(fields: [teamId], references: [id])
  q1 Int @default(0) q2 Int @default(0) q3 Int @default(0) q4 Int @default(0) ot Int @default(0)
  totalYards    Int @default(0)
  passingYards  Int @default(0)
  rushingYards  Int @default(0)
  turnovers     Int @default(0)
  timeOfPossessionSeconds Int? // nullable per Open Question #3; may be dropped

  @@unique([gameId, teamId])
}

model PlayerGameStats {
  id        String @id @default(cuid())
  gameId    String
  game      Game   @relation(fields: [gameId], references: [id])
  playerId  String
  player    Player @relation(fields: [playerId], references: [id])
  teamId    String

  passAttempts Int? passCompletions Int? passYards Int? passTDs Int? interceptions Int?
  carries Int? rushYards Int? rushTDs Int?
  targets Int? receptions Int? receivingYards Int? receivingTDs Int?
  tackles Int? sacks Int? defInterceptions Int?
  fgMade Int? fgAttempts Int? xpMade Int?

  @@unique([gameId, playerId])
  @@index([gameId, teamId])
}
```

`Playbook`: per the spec, this is a **fixed archetype selection per game**, not a
user-authored/persisted entity in Cap 1 — it's stored directly as the four archetype enum
fields on `Game` (`homeOffArchetype`, etc.) rather than a separate `Playbook` row per team
per game. The fixed archetype *definitions* (tendency weights) live as static config inside
`packages/simulation-engine`, not in Postgres, since they don't vary per user in this
capability. If later capabilities need user-editable playbooks, promote this to its own
`Playbook` model then — no migration blocker, since the enum values map 1:1 to a future
`Playbook.archetype` field.

**Ownership query path (private-by-default):** every read of Team/Player/DepthChart/Game
joins up to `Roster.ownerId` (or `Game.ownerId` directly). Composite indexes above
(`Roster.ownerId`, `Game.ownerId, createdAt`, `Team.rosterId`) support `WHERE ownerId = :callerId`
being the first predicate in every query — never an app-layer filter after a broader fetch.

---

## 4. API Design (Capability-1 subset of vision's route list)

All routes require auth; all list/get routes are implicitly scoped `WHERE ownerId = req.user.id`
(via `OwnershipGuard`, not left to each controller to remember).

```
POST   /imports/roster
  multipart/form-data: { file }
  → 201 { importId, status: "PENDING", topLevelError: null }
  → 422 { topLevelError: "Unrecognized file format" }  (no rows created)

GET    /imports/:id/preview
  → 200 {
      importId, fileName, status,
      summary: { created, updated, skipped, failed },  // projected, pre-commit
      rows: [{ sheet, rowIndex, status, messages[], data }]
    }

POST   /imports/:id/commit
  → 200 { rosterId, summary: { created, updated, skipped, failed } }
  → 409 if already committed
  (transactional: all-or-nothing at the "valid rows" level — see §5)

GET    /imports              → list of caller's import history (fileName, date, summary)

GET    /rosters              → caller's rosters (id, name, teamCount, createdAt)
GET    /rosters/:id          → roster detail + team list

GET    /teams?rosterId=      → teams within a roster the caller owns
GET    /teams/:id/players    → players on a team (ownership-checked via team→roster)

GET    /depth-charts/:teamId
  → 200 { teamId, source: "IMPORTED"|"AUTO_GENERATED", entries: [...], warnings: ["MLB unfilled"] }
  (auto-generates + persists on first call if none imported/incomplete)

POST   /games/simulate
  body: {
    homeTeamId, awayTeamId,
    homeOffArchetype, homeDefArchetype, awayOffArchetype, awayDefArchetype,
    seed?: string   // if omitted, server generates and returns it
  }
  → 201 { gameId, status: "COMPLETE", homeScore, awayScore }
  → 422 { error: "UNFILLABLE_POSITIONS", detail: { teamId, positions: ["MLB"] } }
  → 400 if homeTeamId === awayTeamId or either team not owned by caller

GET    /games/:id/box-score
  → 200 {
      gameId, seed, status,
      teams: { home: {...}, away: {...} },
      finalScore: { home, away },
      quarterByQuarter: [{ quarter, home, away }],
      teamStats: { home: {...}, away: {...} },
      playerStats: { home: [...], away: [...] }   // only players with non-zero activity
    }
```

`GET /games/:id/events` (from vision's full list) is **not exposed in Cap 1** — GameEvent
is consumed server-side to build box-score aggregates only, not surfaced as its own route,
per the spec ("not exposed as its own screen/route in this slice").

Ownership enforcement point: `OwnershipGuard` (NestJS guard) attached at the module level for
Rosters/Teams/Players/DepthCharts/Games/Imports — resolves the owning `userId` for the
requested resource (via a small per-module `resolveOwnerId(id)` lookup) and 404s (not 403 —
avoid leaking existence) if it doesn't match `req.user.id`.

---

## 5. Import Pipeline Architecture

```
Upload (multipart)
   │
   ▼
[apps/api] ImportsController.upload()
   │  1. MIME/extension sniff → route to correct parser in packages/importers
   │  2. If parse throws → RosterImport.status = FAILED, topLevelError set, no rows. STOP.
   ▼
packages/importers.parse(file) → RawRow[] grouped by sheet
   │  (CSV: single-sheet, expects a `sheet` column or filename convention;
   │   JSON: top-level keys per sheet; XLSX/XLS: actual workbook sheets by tab name)
   ▼
[apps/api] ImportsService.stageRows()
   │  For each RawRow: run packages/validation schema for that sheet type
   │    - required fields present
   │    - position in fixed enum
   │    - rating 0-99
   │    - cross-row: dup player_id/team_id within this import, dup jersey per team_id
   │  Persist one RosterImportRow per raw row, status = OK|WARNING|ERROR, messages[]
   │  Unknown/optional sheets (Headshots, Bands, Rivalries): parsed if present, stored as
   │    RosterImportRow with sheet name recorded, but ALWAYS status forced to a non-blocking
   │    state — a failure in these sheets never sets ERROR on Players/Teams rows and never
   │    prevents commit. (Architect decision per spec's "silently stored or ignored" call:
   │    store them for audit/future use, but never validate/block on them in Cap 1.)
   ▼
RosterImport.status = PENDING → return importId
   │
   ▼ user reviews preview (rows fetched via GET .../preview), then
[apps/api] ImportsController.commit()
   │  Single Prisma $transaction:
   │    - Reject if any Players/Teams row still has status = ERROR left uncommitted
   │      (spec: "excluded from commit unless fixed and re-uploaded" — Cap 1 semantics:
   │      commit proceeds with OK/WARNING rows only; ERROR rows are always skipped/failed,
   │      never block the rows that ARE valid)
   │    - Create Roster (ownerId = caller, visibility = PRIVATE)
   │    - Create Team rows from valid Teams rows
   │    - Create Player rows from valid Players rows (FK to Team via team_id)
   │    - Create Coach rows from valid Coaches rows, if present
   │    - Create DepthChart rows from valid DepthChart rows, if present and complete;
   │      else leave for auto-generation on first GET /depth-charts/:teamId
   │    - Compute summary counts (created/updated/skipped/failed)
   │    - RosterImport.status = COMMITTED, committedAt = now()
   ▼
Return { rosterId, summary }
```

Validation-rule ownership: `packages/validation` is the single source of truth for row rules,
imported by both `apps/api` (authoritative, blocking) and `apps/web` (client-side pre-check
for instant feedback in the preview UI before the round trip). Web validation is UX-only;
never trust it to skip server validation.

Partial/failed handling: a row-level ERROR never aborts the whole commit — it's counted in
`failedCount` and excluded. A **top-level** parse failure (corrupt file, unsupported
extension) is the only case that produces zero rows and a hard top-level error, per
acceptance criterion 7.

---

## 6. Simulation Engine Architecture

### Package boundary
`packages/simulation-engine` is a pure TypeScript library. No Prisma, no Nest, no HTTP,
no filesystem. Single exported entry point:

```ts
// packages/simulation-engine/src/index.ts
export interface SimInputTeam {
  teamId: string;
  offArchetype: OffensiveArchetype;
  defArchetype: DefensiveArchetype;
  players: SimPlayer[];        // full roster, with ratings
  depthChart: SimDepthChartEntry[];
}

export interface SimulationInput {
  home: SimInputTeam;
  away: SimInputTeam;
  seed: string;                 // deterministic seed
  ruleset?: RulesetOverrides;   // Cap 1: always defaults, param exists for forward-compat
}

export interface SimulationResult {
  finalScore: { home: number; away: number };
  quarterByQuarter: { quarter: number; home: number; away: number }[];
  events: SimGameEvent[];                  // drives/scoring events, internal detail
  teamStats: { home: SimTeamStats; away: SimTeamStats };
  playerStats: SimPlayerStat[];             // only players with activity
}

export function simulateGame(input: SimulationInput): SimulationResult;
```

- **Determinism strategy:** a seeded PRNG (e.g., mulberry32/xorshift seeded from `input.seed`,
  hashed from string→uint32) is instantiated once per call and threaded through every random
  decision (play call within archetype tendencies, yardage variance, turnover rolls). No
  `Math.random()`, no wall-clock, no external I/O anywhere in the engine — this is what makes
  "same seed → byte-identical output" achievable and unit-testable in isolation.
- Engine internally may model penalties/injuries/weather/home-field/fatigue (per vision's
  full design) but Cap 1's `RulesetOverrides` always forces these off; the *capability* to
  add them later is a config flag the engine already accepts, not a rewrite.
- Reused as-is by MVP 2's presentation layer: `events` output already carries the shape
  needed for a future play-by-play timeline; Cap 1 just doesn't expose it via API.

### Sync vs. worker — decision: **run synchronously inside `apps/api`**

Justification:
- Spec explicitly allows either (`Open Questions #4`) and reserves BullMQ for "long games /
  multi-game runs," which are out of scope here.
- A single Cap-1 game (4 quarters, no penalties/injuries/weather) is a bounded, CPU-light
  computation — expected to run in low tens-of-milliseconds to low hundreds-of-milliseconds,
  well within an HTTP request budget.
- Running synchronously means `POST /games/simulate` returns the finished game in one
  round trip — simpler UI (no polling/job-status screen needed), which matches the acceptance
  criterion "I am taken to a result screen without further input required."
- Trade-off accepted: if engine complexity grows before MVP 2 (e.g., a "long game" or
  batch-simulate feature), this call site moves to enqueue a BullMQ job instead. Because
  `GamesModule` calls `simulateGame()` as a plain function today, migrating to
  `worker.add('simulate', input)` later is a call-site change only — the engine package and
  its input/output contract do not change. `apps/worker` already exists in the monorepo and
  imports the same `packages/simulation-engine`, so no duplicate implementation risk.

`GamesModule.simulate()` responsibility:
1. Validate ownership of both teams, teams distinct.
2. Load teams/players/depth-charts, run `DepthChartsModule`'s legality check (min-viable
   lineup — see below) — if it fails, return 422 without creating a Game row's terminal state.
3. Create `Game` (status RUNNING) → call `simulateGame()` → in one transaction, write
   `Game` (COMPLETE, scores), `GameEvent[]`, `TeamGameStats`, `PlayerGameStats`.
4. Return gameId.

**Minimum viable roster / unfillable position handling:** `DepthChartsModule` exposes
`checkLegality(teamId): { legal: boolean; unfilled: Position[] }`. A team is legal if every
required starting position (per vision's fixed position list) has at least one eligible
player at that position group; "eligible" and any position-group flexibility (e.g., filling
FB from RB pool) is an Engineering-level tuning call inside that service, not an API contract
change. UI disables "Run Game" and shows `unfilled` if `legal === false`.

---

## 7. Key Architectural Decisions & Trade-offs

| Decision | Choice | Alternatives considered | Why |
|---|---|---|---|
| Determinism | Seeded PRNG threaded through a pure function, no engine-internal randomness sources outside it | Record/replay of `Math.random()` calls | Pure-seed approach is simpler, trivially testable, and required by acceptance criterion (byte-identical repeat runs) |
| Engine location | Standalone `packages/simulation-engine`, framework-free | Simulate inline inside `GamesModule` (Nest service) | Must be reusable unchanged by `apps/worker` later and by MVP 2's presentation layer without dragging Nest/HTTP deps into it |
| Sync vs. worker | Synchronous in `apps/api` for Cap 1 | BullMQ job with polling/status endpoint | Spec explicitly defers worker use to "long games"; sync is less UI complexity for a fast, bounded computation; call-site swap later is cheap |
| Playbook persistence | Enum fields on `Game`, not a separate `Playbook` table | Persisted `Playbook` entity per team per game now | Cap 1 playbook is a fixed-list selection, not user-authored; avoids a table with no independent lifecycle yet. Forward-compatible: promote to a table when playbooks become user-editable |
| Commit transactionality | Single Prisma `$transaction` wrapping all entity writes for a commit | Row-by-row best-effort writes | Spec requires an atomic-feeling "created Roster with all valid rows" outcome and a reliable summary count; partial-roster states on failure would be confusing and hard to recover from |
| Ownership enforcement | Guard/interceptor at the module boundary, resource ownership resolved server-side from DB, every list/get query filters by ownerId first | UI-only hiding of other users' data | Spec explicitly requires "no other user can see or query it" — must be enforced at the data/API layer, not trust the client |
| Non-required sheets (Headshots/Bands/Rivalries) | Parse-and-store as `RosterImportRow` with sheet name, never validated/blocking | Fully ignore/discard immediately | Cheap to store now (same row table), avoids re-parsing the file if a later capability needs it, and costs nothing in Cap 1 since it's never read back |

---

## 8. Cross-Cutting Concerns

- **Auth/ownership:** Assume platform-level auth (session/JWT) already resolves `req.user.id`.
  `OwnershipGuard` pattern (per module) is the single enforcement mechanism — Frontend must
  never assume "I didn't render it" is sufficient; Backend always re-checks.
- **File upload handling/storage:** Uploaded roster files (CSV/JSON/XLSX/XLS) are parsed
  in-memory/stream and **not required to be retained** for Cap 1 (no re-download-original-file
  feature in scope). If retained for audit, store outside app runtime (Supabase
  Storage/S3-compatible, per vision's storage choice), with size/MIME validation at the
  controller boundary before it ever reaches `packages/importers`.
- **Legal/Compliance flag (spec-raised):** uploaded files may contain arbitrary user-typed
  strings (player/team names) — flag to Legal/IP Safety that Cap 1 does not restrict what a
  user types into their own private roster (it's their fictional content), but any *sample
  templates or seed/demo data shipped by Heritage Saturday itself* must pass the brand-safety
  rule. Retention/PII: no real PII fields exist in the Players/Teams schema (no email, no
  real name requirement) — flag this as low PII risk, but confirm no requirement to purge
  uploaded raw files after commit (Cap 1 assumption: keep `RosterImportRow.rawData` indefinitely,
  same as "rosters simply persist" assumption in the spec).
- **Validation-schema sharing:** `packages/validation` used by both `apps/web` (instant
  feedback) and `apps/api` (authoritative). Any rule change is a one-package edit, not two.
- **Error handling convention:** all API error responses use a shared shape from
  `packages/shared`:
  ```ts
  { statusCode: number; error: string; message: string; detail?: Record<string, unknown> }
  ```
  Domain-specific error codes (`UNFILLABLE_POSITIONS`, `IMPORT_ALREADY_COMMITTED`,
  `UNSUPPORTED_FILE_FORMAT`) travel in `error`, human message in `message`, structured extra
  info (e.g., which positions) in `detail`. Frontend should switch on `error`, not parse
  `message` strings.
- **Logging:** import commit and game simulate are the two operations worth structured
  logging (importId/gameId, ownerId, duration, row/error counts) for later QA/debugging —
  standard NestJS logger, no new infra needed for Cap 1.

---

## 9. Forward-Compatibility Notes

- **Seasons/standings/schedule:** `Game` already stands alone (no `Schedule`/`Season` FK).
  Adding a `Schedule` entity later just adds a nullable `scheduleId` to `Game`; no rework.
- **Bands/rivalries:** `Team` already has a slot for these to attach (`Band`, `Rivalry` join
  via `teamId`) once those entities exist; Cap 1's Team schema doesn't need to change, only grow.
- **Headshots:** `Player.headshotUrl`/`headshotFileName`/`portraitPath` already exist as
  columns (populated if present in import, unused by UI) — a future `HeadshotAsset` service
  can backfill/manage them without a Player schema change.
- **Commissioner roles / LEAGUE visibility:** `Roster.visibility` enum already has room for
  `LEAGUE`/`SHARED_LINK`/`PUBLIC_TEMPLATE` (commented as reserved) — the `OwnershipGuard`
  pattern generalizes to a role-check guard later without changing the resource-resolution
  approach.
- **Broadcast presentation (MVP 2):** `GameEvent.payload` (Json) is intentionally
  loosely-typed engine output — MVP 2's presentation-timeline consumer can read the same
  events Cap 1 already writes, just render them differently (Cap 1 never deletes/transforms
  this data away, it only doesn't expose a `/games/:id/events` route yet).
- **Manual depth-chart editing:** `DepthChart`/`DepthChartEntry` already support arbitrary
  slot reassignment via `PATCH /depth-charts/:teamId` (not built in Cap 1, but the schema
  needs no change to support it — only a new endpoint + UI).
