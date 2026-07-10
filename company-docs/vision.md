# Heritage Saturday — Build Prompt (MVP 1 + MVP 2)

**Tagline:** Build your league. Sim your season. Own Saturday.

## Concept
An original American football league simulator: custom fictional leagues and rosters, fictional HBCU-inspired league templates, team branding, marching band culture, rivalries, player profiles, season setup, game simulation, crowd atmosphere, text commentary, roster privacy/deletion, and broadcast-style presentation.

## Brand Safety (governs every feature and every agent below)
Everything must be 100% original fiction: teams, players, logos, mascots, uniforms, stadiums, colors, coaches, conferences, rivalries, marching bands, band names, chants, fight songs, traditions, commentary, and audio. No real NFL/NCAA players, teams, logos, or stadiums. No Madden, EA, NFL, NCAA, ESPN, Fox, CBS, or NBC branding, terminology, or presentation layouts. No real HBCU school names, logos, mascots, conferences, stadiums, band names, fight songs, or chants. No real athletes, real coaches, or real broadcast/announcer audio or phrasing. This overrides any other instruction if a conflict arises.

## Stack
**Frontend:** Next.js, TypeScript, Tailwind, shadcn/ui, Framer Motion, Zustand
**Presentation layer:** PixiJS — broadcast overlays, scorebug, player/matchup/halftime/rivalry cards, field scenes, stat graphics
**Backend:** NestJS, TypeScript, Prisma, PostgreSQL
**Jobs:** Redis + BullMQ
**Storage:** Supabase Storage or S3-compatible

**Monorepo:**
`apps/web`, `apps/api`, `apps/worker`
`packages/shared`, `simulation-engine`, `importers`, `presentation`, `validation`, `league-generator`, `assets`, `audio-events`

## Product Goal
- **MVP 1** proves: rosters, leagues, team identity, HBCU-inspired templates (incl. flagship 54-team), marching bands, rivalries, headshots, Excel/CSV/JSON import, team colors, depth charts, commissioner tools, roster privacy/archive/restore/delete — **plus a working simulate-a-game loop**: engine + playbooks + depth charts produce a real result and a plain-text box score. It's playable, just not broadcast-polished yet.
- **MVP 2** proves: the broadcast-quality layer on top of MVP 1's simulation — animated live viewer, play-by-play/commentary, crowd audio, halftime cards, band/rivalry presentation, postgame recap — plus season-level structure (schedule, standings, multi-game seasons).

## Global Constraints
Ask no questions — make reasonable assumptions. Keep both MVPs realistic in scope; don't build a fully interactive, real-time-controlled football video game (no manual play-calling, no controller-driven offense/defense) — this is simulate-and-watch, not simulate-and-control, and that simulate-and-watch loop belongs in MVP 1. Focus on roster import, league management, simulation, and presentation. Portfolio-quality vertical slice. Generate starter code after the full plan.

---

## Agent Responsibilities

**Product Manager** — Scope MVP 1/2, user stories, acceptance criteria, product flows, release phases, sprint plans, success metrics.

**Legal/IP Safety** — Audit every feature against the Brand Safety rule above; sign off on all teams, players, schools, logos, colors, rivalries, bands, chants, audio, and presentation assets before they're treated as final.

**UX/UI Design** (mobile-first) — Dashboard, league templates, roster import/preview/list/detail/settings/archive, teams, players, team colors, headshot mapping, depth charts, schedule, standings, game center, live simulation, box score, halftime summary, band spotlight, rivalry pages, classic-game pages, audio settings, postgame recap.

**Frontend Engineering** — Next.js routes, components, state stores, hooks, forms, upload flows, validation states, image/audio handling, mobile responsiveness, role checks, roster privacy/archive/delete controls, presentation screens.

**Backend Engineering** — NestJS services + Prisma schema for rosters (incl. visibility/archive/delete), leagues, teams, players, bands, rivalries, standings, schedule, game results, commentary, audio events.

**Roster Import** — CSV/JSON/XLSX/XLS with validation, preview, row-level errors, downloadable templates, import summaries, duplicate handling, rollback, export, ownership assignment, private-by-default visibility, audit logs.

**Excel Import** — Workbook sheets and required columns:
- **Players:** player_id, team_id, first_name, last_name, position, jersey_number, height, weight, age, college, archetype, overall_rating, speed, strength, awareness, throw_power, throw_accuracy, catching, route_running, carry, trucking, pass_block, run_block, tackle, coverage, kick_power, kick_accuracy, headshot_url, headshot_file_name, portrait_path
- **Teams:** team_id, city, state, team_name, abbreviation, primary/secondary/accent/neutral/text/helmet color, home/away/alternate jersey color, pants_color, socks_color, endzone_color, scorebug_color, stadium_name, coach_name, conference, division
- **Coaches:** coach_id, team_id, first_name, last_name, offensive_style, defensive_style, aggression/discipline/development/game_management ratings
- **DepthChart:** team_id, position, starter_player_id, backup_1/2/3_player_id
- **Headshots:** player_id, full_name, team_id, jersey_number, headshot_url, headshot_file_name, portrait_path
- **Bands:** band_id, school_id, band_name, band_nickname, band_style, drumline_style, signature_entrance, halftime_show_theme, homecoming_show_theme, rivalry_show_theme, uniform_description, crowd_energy_rating, tradition_blurb, game_day_phrase, stadium_atmosphere_tag, presentation_cue
- **Rivalries:** rivalry_id, team_a_id, team_b_id, rivalry_type, rivalry_name, rivalry_trophy_name, classic_game_name, neutral_site_name, is_protected, is_active, rivalry_score, history_summary, band_storyline

Requirements: support .xlsx/.xls, downloadable templates, preview before import, row-level errors, import summary (created/updated/skipped/failed), export back to Excel; validate required sheets, warn on missing optional sheets; reject malformed files, empty required fields, duplicate player/team IDs, duplicate jersey numbers on the same team, invalid positions, out-of-range ratings; warn on broken headshot mappings, poor color contrast, missing band profiles, invalid rivalry pairings.

**Roster Ownership & Visibility**
Fields: roster_id, created_by_user_id, league_id, name, description, visibility, status, source_roster_id, is_cloneable, clone_count, created_at, updated_at
Visibility values: PRIVATE, LEAGUE, SHARED_LINK (later), PUBLIC_TEMPLATE (later)
Rules: rosters are PRIVATE by default, visible only to creator/league owner/approved commissioners. Creators can promote PRIVATE → LEAGUE. Team managers see LEAGUE rosters only within their own league. Viewer access follows league settings. Non-owners can never edit another user's original roster. Cloning (later phase): creates a copy, keeps original creator credited, tracks source_roster_id.
Routes: `GET/POST /rosters`, `GET/PATCH /rosters/:id`, `PATCH /rosters/:id/visibility`, `POST /rosters/:id/clone`, `DELETE /rosters/:id`

**Custom Roster Delete & Archive**
Statuses: ACTIVE, ARCHIVED, DELETED
Fields: roster.status, deleted_at, deleted_by, archived_at, archived_by
Behavior: allow delete if no saved games exist; recommend archive over delete if completed games exist; require selecting a replacement roster before deleting an active league roster; show affected headshot/asset counts; preserve import audit log unless user chooses full removal; write an audit log entry on every delete/archive/restore.
Confirmation modal must show: roster name, league name, team count, player count, headshot count, games affected — and require typing the roster name before hard delete.
Routes: `DELETE /rosters/:id`, `POST /rosters/:id/archive`, `POST /rosters/:id/restore`

**Headshot Asset** — Support headshot URLs, ZIP upload, manual assignment, and auto-matching by player_id, file name, full name, or jersey+team. Fallback placeholder, preview during import, unmatched-image/unmatched-player review, resizing/caching, safe file names, duplicate handling, delete/replace. Headshots appear across player profiles, rosters, team pages, depth charts, matchups, stat overlays, cards, and recaps.

**Team Identity & Colors** — Fields: primary/secondary/accent/neutral/text/helmet color, home/away/alternate jersey color, pants/socks/endzone/scorebug color — used consistently across rosters, team pages, cards, standings, schedule, scorebug, overlays, uniforms, band/rivalry/homecoming cards. Validate HEX format, warn on low contrast or duplicate palettes across teams, generate fallbacks for missing colors, allow commissioner edits pre- and post-import. Must not mirror real-world team/league color-and-logo combinations.

**Fictional HBCU-Inspired League Templates** — Fully original schools/mascots/logos/colors/stadiums/coaches/players/rivalries/bands/traditions, inspired only by the *format* of HBCU football (regional pride, homecoming, band culture), never by real names or assets.
Presets: 8-team demo, 16-team quick season, 24-team standard, and a flagship **54-team** league (4 conferences / 8 divisions): Heritage Football Conference (14), Southern Legacy Athletic Conference (14), Atlantic Crown Conference (14), Gulf Coast Collegiate Union (12).
Each team: school_id, school_name, team_name, abbreviation, city, state, conference, division, color set, stadium_name, coach_name, rival_school_id, classic_game_name, homecoming_week, band_style, tradition_blurb, team_strength_profile. Sample original school names: Capital City State, Delta Heritage A&M, Magnolia Tech, Tidewater Union, Pine Grove State, Coastal Legacy College, Prairie Heights, Carolina Legacy University, Gulfside A&M, East Meridian State, Blue Ridge Heritage, Red River Southern.

**Marching Band & Game Day Culture** — Fields: band_id, school_id, band_name, band_nickname, band_style, drumline_style, signature_entrance, halftime_show_theme, homecoming_show_theme, rivalry_show_theme, uniform_description, crowd_energy_rating, tradition_blurb, game_day_phrase, stadium_atmosphere_tag, presentation_cue.
Band styles: Precision Corps, High-Energy Show Band, Brass-Heavy Power Band, Drumline-Forward Band, Dance-Line Showcase Band, Traditional Field Band, Modern Fusion Band, Homecoming Spectacle Band.
Sample band names: The Royal Sound, The Crimson Storm, The Golden Cadence, The Sonic Crown, The Marching Flame, The Blue Thunder Regiment, The Pride Ensemble, The Heritage Sound Machine, The Emerald Pulse, The Monarch Marching Unit.
Sample record:
```json
{
  "band_id": "BAND_CCS",
  "school_id": "CCS",
  "band_name": "The Royal Sound",
  "band_nickname": "The Crown Line",
  "band_style": "High-Energy Show Band",
  "drumline_style": "Fast tempo, heavy snare presence, crowd-response cadences",
  "signature_entrance": "The band enters from the east tunnel in a split formation before joining at midfield.",
  "halftime_show_theme": "A celebration of city pride, brass power, and legacy rhythms.",
  "homecoming_show_theme": "The alumni section joins the final formation for a campus tribute.",
  "rivalry_show_theme": "A bold call-and-response routine built for rivalry week.",
  "uniform_description": "Deep purple jackets with gold trim, white gloves, and black shakos.",
  "crowd_energy_rating": 92,
  "tradition_blurb": "Known for turning close games into full-stadium call-and-response moments.",
  "game_day_phrase": "Raise the Crown",
  "stadium_atmosphere_tag": "Loud, rhythmic, tradition-heavy",
  "presentation_cue": "Show band spotlight before kickoff and halftime card after second quarter."
}
```
MVP 1: band profile for all 54 flagship schools, shown on team pages and template preview, homecoming/classic labels on schedule, band fields in schema + Excel template + commissioner editing.
MVP 2: bands drive pregame/halftime/rivalry presentation and the live viewer's crowd atmosphere; generate fictional halftime/homecoming/classic-game summaries. Band/crowd energy affects *presentation only*, never player ratings, and never simulation results unless home-field advantage is explicitly enabled.

**Rivalry Logic**
Types: primary protected, secondary, classic game, homecoming, band, emerging.
Rules: every team gets one mutual, seeded, yearly primary rival with special presentation. Up to two secondary rivals, generated from scoring. Emerging rivalries form from repeated close games/upsets/playoff meetings and require commissioner approval.
Scoring weights (0–100 scale): geographic proximity 25, same conference 20, same division 20, similar strength 15, classic-game connection 15, playoff meetings 15, band style contrast 10, shared recruiting region 10, recent close games 10, recent upsets 10, historical win balance 10, homecoming history 5, star player matchup history 5, stadium atmosphere 5.
Levels: 70+ strong, 50–69 secondary, 35–49 potential, <35 normal matchup.
Fields: rivalry_id, league_id, team_a_id, team_b_id, rivalry_type, rivalry_name, rivalry_trophy_name, classic_game_name, neutral_site_name, is_protected, is_active, rivalry_score, history_summary, band_storyline, created_by, created_reason.
Scheduling: protected rivalries scheduled every season, classic games get priority placement, rivalry games avoid early season and favor late-season slots; homecoming doesn't override a primary rivalry unless the commissioner chooses.

**Commissioner Mode** — Roles: Owner, Commissioner, Team Manager, Viewer. Full CRUD over leagues, rosters (incl. visibility/archive/delete), teams, colors, players, ratings, headshots, depth charts, playbooks, bands, schedules, homecoming/rivalry/classic games; approve or roll back roster imports; export rosters; delete leagues.

**Depth Chart** — Auto-generate from ratings; allow manual edits; detect missing starters, invalid positions, injured players, duplicate assignments, and mis-slotted position groups. Positions: QB, RB, FB, WR, TE, LT, LG, C, RG, RT, LE, RE, DT, LOLB, MLB, ROLB, CB, FS, SS, K, P, KR, PR.

**Playbook** — Offensive archetypes: Balanced, Power Run, Spread, Vertical Passing, West Coast, Option/RPO, Play Action Heavy. Defensive archetypes: Balanced 4-3, Base 3-4, Nickel Zone, Blitz Heavy, Man Coverage, Bend-Don't-Break, Run Stop. Each defines tendencies (run/pass split, pass depth mix, tempo, aggressiveness, situational logic by down/distance/score/field position/time, turnover risk, personnel). All names/labels must be original — no real playbook or terminology packages. **Needed starting MVP 1** (simulation depends on it).

**Simulation Engine** — Deterministic engine (accepts teams, rosters, depth charts, playbooks, weather, venue, rules, atmosphere, random seed). Outputs: play-by-play, drives, scoring events, penalties, injuries, team/player stats, win probability, final score, box score, presentation timeline, and audio/commentary triggers. Supports 4 quarters (configurable length), overtime, downs/distance, punts/FGs/TDs/XPs, turnovers, and optional penalties/injuries/fatigue/weather/home-field advantage. Two-point attempts are a later feature flag. **MVP 1** needs the engine itself plus final score/box score output; **MVP 2** consumes the same engine's presentation-timeline and audio/commentary trigger output for the broadcast layer.

**Stats & Records** — Single-game team/player stats (passing, rushing, receiving, defense, kicking, punting), turnovers, penalties, time of possession, 3rd-down/red-zone efficiency, standings, W-L, points for/against, differential. Basic single-game stats/box score needed in **MVP 1**; league-wide standings and leaders are **MVP 2** (season structure).

**Commentary** — Types: pregame intro, team/band/homecoming/rivalry/classic intro, kickoff, big play, TD, turnover, sack, FG, red zone, 3rd/4th down, halftime, momentum shift, player spotlight, injury update, weather, postgame recap, top performer. Inputs: event type, quarter, clock, down/distance, field position, score margin, teams, player, colors, band profile, rivalry/homecoming/classic flags, weather, momentum, records, stats. Behavior: short lines live, longer summaries pre/half/postgame; avoid repetition within a game; vary tone by game stakes; all lines original and template-driven (DB or JSON), with AI-generated commentary as a future feature flag. No real announcers, network phrasing, or league branding. Voice/TTS commentary is MVP 3+.

**Crowd Audio & Stadium Atmosphere** — Fully original audio system (no real broadcast/school/band/NFL/NCAA audio or copyrighted music). Event types span ambient loop, pregame build, kickoff swell, 3rd-down rise, red-zone rise, TD/turnover/sack/big-play reactions, halftime response, homecoming/rivalry/classic boosts, postgame celebration/disappointment. Intensity (Quiet → Steady → Loud → Charged → Peak) responds to crowd/band energy, game flags, score margin, down/distance, recent big plays, and stadium context; falls during blowouts. Implementation: audio manager service, looped ambient + stingers, crossfades, autoplay-safe (starts after user interaction), mute + master/crowd/commentary/band volume controls, reduced-audio mode, persisted user settings.

**Presentation** — Original broadcast-style system (no Madden/EA/NFL/ESPN/Fox/CBS/NBC layouts): pregame matchup, band spotlight, team intro, scorebug, clock, down/distance, ball position, drive summary, play-by-play feed, stat/comparison/headshot cards, TD/turnover screens, halftime band card, end-of-game recap, top performers, momentum indicator, weather/atmosphere, homecoming/rivalry/classic presentation, text commentary, crowd audio controls — all driven by simulation timeline events and league metadata.

**Real-Time Game Viewer** — Start/pause/resume, speed controls, skip-to-drive, instant result, replay summary, event timeline, animated score changes, stat/player card triggers, possession changes, halftime/band-spotlight/rivalry-moment/crowd-audio/commentary/postgame sequences.

**Save System & Versioning** — Roster version history, import history + rollback, audit logs, saved simulation results/box scores/recap data, league settings history, user audio preferences, roster archive/deletion/visibility history.

**Rules Engine** — Configurable: quarter length, OT format, playoff size, roster limits, injury/fatigue frequency, weather impact, home-field advantage, sim speed, tiebreakers, schedule length, homecoming/classic/rivalry scheduling rules, commentary/crowd-audio toggles, roster visibility defaults, roster deletion policy.

**Security** — Auth, file/MIME/size validation, ZIP structure scanning, path-traversal rejection, file name normalization, files stored outside app runtime, signed URLs for private assets, role-based commissioner permissions, private-roster edit protection, non-commissioner delete protection, reject unapproved audio uploads in MVP 2.

**Performance** — Roster import preview handles 3,000 players; 54-team template loads fast; team pages paginate/virtualize; headshot thumbnails; simulation runs in a worker for long games; live viewer stays smooth on mobile; audio decoupled from simulation/UI logic.

**QA Automation** — Automated tests across: CSV/JSON/Excel import, headshot ZIP upload/matching, team color validation, band/rivalry import, template + 54-team league generation, depth chart (auto + manual), roster privacy/visibility/archive/restore/delete + permission checks, simulation outputs, playbook weighting, commentary templates, crowd audio triggers, standings, box scores, API errors, role permissions, mobile UI states, presentation timeline events.

**DevOps** — Docker Compose (Postgres, Redis, API, worker, web), Prisma migrations, seed script, storage bucket setup, env var examples, deployment plan, logging/monitoring/backups.

**Documentation** — Developer setup, user docs, roster/Excel/headshot import docs, roster privacy/archive/delete docs, band/rivalry/commentary/audio docs, commissioner guide, league template guide, simulation guide, troubleshooting, API docs.

---

## MVP 1 Scope
League dashboard; HBCU-inspired templates (8/16/24/54-team presets); league creation from template; roster import (CSV/JSON/XLSX/XLS) private by default with PRIVATE→LEAGUE visibility switch, archive/restore/safe delete; Excel template download + export; import preview with row-level validation and summary; team pages, player profiles, team colors/branding; band profiles; rivalry setup (protected + classic games + homecoming week); headshots (URL + ZIP upload + mapping screen); depth charts (auto + manual); commissioner tools; saved rosters, import history, rollback; mobile-first UI; basic auth and role permissions. **Plus: basic game simulation** — game setup screen (pick two teams), run a single game using the deterministic engine, playbook archetypes, and depth charts, with a plain-text play-by-play and box score (final score, quarter-by-quarter, simple stat line — no broadcast presentation yet).

**MVP 1 Deliverables:** PRD, user stories, screen list, route map, DB schema, API design, roster import/ownership/archive-delete specs, Excel template spec, headshot mapping spec, team color system, band + rivalry data models, HBCU template data + 54-team generation rules, frontend component breakdown, backend module breakdown, Prisma schema, seed data, validation schemas, sprint-1 task list, QA plan, dev setup plan, **plus: simulation engine design, playbook schema, and basic game-result/box-score schema**.

## MVP 2 Scope
The broadcast-quality layer on top of MVP 1's simulation engine: animated live viewer with play-by-play, text commentary, optional crowd audio; scorebug, clock, down/distance, drive summaries; enriched box score, team/player stats, win probability; postgame recap + top performers; presentation timeline incl. pregame band spotlight, halftime band summary, homecoming/rivalry/classic presentation; replay-style recap; mobile-friendly game center. **Plus season-level structure**: schedule, standings, multi-game seasons.

**MVP 2 Deliverables:** game event/presentation-timeline schema, commentary/crowd-audio schemas, live viewer design, PixiJS component plan, worker job plan for long/multi-game runs, box score + postgame recap + band + rivalry presentation designs, halftime summary design, schedule/standings design, QA plan, sprint-2 task list.

---

## Starter Code (generate after the plan)
Prisma schema; NestJS modules; roster import validator; roster ownership service; roster visibility guard; roster archive/delete services; Excel parser; headshot mapping service; team color validator; band/rivalry/commentary/audio-event schemas; fictional league seed generator + 54-team template generator; simulation engine pseudocode + event/playbook types; Next.js route structure; roster upload/preview/settings/archive/delete-confirmation UI; headshot mapping UI; team, band, rivalry, player, depth-chart UI; live game viewer UI; scorebug, commentary feed, crowd audio controls, halftime band card, and postgame recap components.

## Web Routes
```
/
/dashboard
/leagues
/leagues/new
/leagues/templates
/leagues/[leagueId]
/leagues/[leagueId]/rosters
/leagues/[leagueId]/rosters/[rosterId]
/leagues/[leagueId]/rosters/[rosterId]/settings
/leagues/[leagueId]/teams
/leagues/[leagueId]/teams/[teamId]
/leagues/[leagueId]/players/[playerId]
/leagues/[leagueId]/bands/[bandId]
/leagues/[leagueId]/rivalries
/leagues/[leagueId]/schedule
/leagues/[leagueId]/standings
/leagues/[leagueId]/imports
/leagues/[leagueId]/imports/new
/leagues/[leagueId]/headshots
/leagues/[leagueId]/depth-chart
/leagues/[leagueId]/games/[gameId]
/leagues/[leagueId]/games/[gameId]/live
/leagues/[leagueId]/games/[gameId]/box-score
/leagues/[leagueId]/games/[gameId]/recap
/settings
```

## API Routes
```
POST /auth/register
POST /auth/login
GET/POST /leagues
GET/PATCH /leagues/:id
POST /leagues/from-template
GET /templates
GET /templates/:id
GET/POST /rosters
GET/PATCH /rosters/:id
PATCH /rosters/:id/visibility
POST /rosters/:id/archive
POST /rosters/:id/restore
POST /rosters/:id/clone
DELETE /rosters/:id
GET/POST /teams
PATCH /teams/:id
GET/POST /players
PATCH /players/:id
GET/POST /bands
PATCH /bands/:id
GET/POST /rivalries
PATCH /rivalries/:id
POST /imports/roster
GET /imports/:id/preview
POST /imports/:id/commit
POST /imports/:id/rollback
POST /headshots/upload
POST /headshots/map
GET/PATCH /depth-charts/:teamId
POST /games/simulate
GET /games/:id
GET /games/:id/events
GET /games/:id/box-score
GET /games/:id/recap
GET /standings/:leagueId
GET /schedule/:leagueId
GET/POST /commentary/templates
PATCH /commentary/templates/:id
GET/PATCH /audio/settings
```

## Database Entities
User, League, LeagueMember, Roster, RosterPermission, RosterVisibility, RosterImport, RosterImportRow, RosterVersion, Team, Player, Coach, Band, Stadium, HeadshotAsset, DepthChart, Game, GameEvent, Drive, TeamGameStats, PlayerGameStats, Schedule, Standing, Playbook, LeagueRule, Rivalry, ClassicGame, HomecomingGame, CommentaryTemplate, AudioEvent, UserAudioSetting, AuditLog

---

## Output Format
1. Product plan → 2. MVP 1 → 3. MVP 2 → 4. Architecture → 5. Database design → 6. API design → 7. Frontend route map → 8. Starter code → 9. QA tests → 10. Sprint plan

Keep all generated examples fictional and original.
