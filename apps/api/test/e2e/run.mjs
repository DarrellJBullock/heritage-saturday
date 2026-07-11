// Heritage Saturday — Capability 1 QA end-to-end suite.
// Drives the real HTTP API (must be running, default http://localhost:3001)
// against the real Postgres DB. Not a Jest/pytest suite — plain Node script
// using built-in fetch, chosen because there is no existing e2e test harness
// wired up in apps/api yet (only unit tests exist in packages/*).
//
// Prereqs: API running, DB migrated, and the seeded User rows (`npx prisma db seed`):
//   qa-user-a, qa-user-b — the identities this suite drives the API as;
//   dev-user-1           — the identity apps/web's dev-login signs in as.
//
// Usage: node apps/api/test/e2e/run.mjs
//
// Set WEB_BASE (e.g. http://localhost:3000) with apps/web running under ALLOW_DEV_LOGIN=true to
// additionally exercise the proxy's identity assertion — that a signed-in browser cannot forge
// `x-user-id`. Skipped when unset, but REQUIRED under CI.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.API_BASE ?? 'http://localhost:3001';
const USER_A = 'qa-user-a';
const USER_B = 'qa-user-b';

// Capability 2: every roster/import/game is nested under a league. Each user gets a fresh league
// created at the start of main(); imports and games are addressed under it.
let LEAGUE_A = null;
let LEAGUE_B = null;
const leagueOf = (user) => (user === USER_B ? LEAGUE_B : LEAGUE_A);

// apps/web, if it is running. The proxy section below needs it; everything else drives the API
// directly. Unset, that section is skipped — except under CI, where it is mandatory (a security
// check that silently stops running is worse than no check at all).
const WEB = process.env.WEB_BASE ?? null;
// The seeded user apps/web's dev-login provider signs in as. Distinct from USER_A/USER_B, which
// is the point: the session says dev-user-1 no matter what the request headers claim.
const DEV_LOGIN_USER = 'dev-user-1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '..', 'e2e-fixtures');

let pass = 0;
let fail = 0;
const failures = [];

function ok(desc, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${desc}`);
  } else {
    fail += 1;
    failures.push({ desc, extra });
    console.log(`  FAIL  ${desc}`);
    if (extra !== undefined) console.log('        ' + JSON.stringify(extra));
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

async function api(method, urlPath, { user, body, file, fileName } = {}) {
  const headers = {};
  if (user) headers['x-user-id'] = user;
  let payload;
  if (file) {
    const form = new FormData();
    form.append('file', new Blob([file]), fileName ?? 'upload.csv');
    payload = form;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: payload });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, body: json };
}

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name));
}

// --- apps/web helpers (proxy identity section) --------------------------------

/** Accumulate Set-Cookie into a jar. An empty value is Auth.js clearing a cookie. */
function mergeSetCookie(jar, res) {
  for (const raw of res.headers.getSetCookie()) {
    const eq = raw.split(';')[0].indexOf('=');
    if (eq === -1) continue;
    const name = raw.slice(0, eq).trim();
    const value = raw.split(';')[0].slice(eq + 1).trim();
    if (value === '') jar.delete(name);
    else jar.set(name, value);
  }
}

/** `redirect: 'manual'` so a 307 to /signin is observable rather than followed. */
async function web(urlPath, { jar, headers = {}, method = 'GET', body } = {}) {
  const h = { ...headers };
  if (jar?.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(`${WEB}${urlPath}`, { method, headers: h, body, redirect: 'manual' });
  let json = null;
  try {
    json = await res.clone().json();
  } catch {
    // HTML or empty body
  }
  return { status: res.status, body: json, location: res.headers.get('location'), res };
}

/**
 * Drive the real Auth.js dev-login flow rather than forging a cookie: csrf token -> credentials
 * callback -> session cookie. Requires apps/web running with ALLOW_DEV_LOGIN=true and
 * NODE_ENV != production.
 */
async function signInAsDevUser() {
  const jar = new Map();
  const csrf = await web('/api/auth/csrf', { jar });
  mergeSetCookie(jar, csrf.res);
  const csrfToken = csrf.body?.csrfToken;
  if (!csrfToken) throw new Error('apps/web returned no csrfToken; is it running with AUTH_SECRET?');

  const callback = await web('/api/auth/callback/dev-login', {
    jar,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${WEB}/` }).toString(),
  });
  mergeSetCookie(jar, callback.res);
  return jar;
}

async function uploadAndCommit(user, fixtureName, label) {
  const lg = leagueOf(user);
  const buf = readFixture(fixtureName);
  const upload = await api('POST', `/leagues/${lg}/imports/roster`, { user, file: buf, fileName: fixtureName });
  if (upload.status !== 201) {
    return { upload };
  }
  const importId = upload.body.importId;
  const preview = await api('GET', `/leagues/${lg}/imports/${importId}/preview`, { user });
  const commit = await api('POST', `/leagues/${lg}/imports/${importId}/commit`, { user });
  return { upload, preview, commit, importId };
}

/**
 * The API believes `x-user-id`. That is only safe because the browser cannot set it: apps/web's
 * /api/proxy route strips whatever arrives and re-asserts the id from the session. These checks
 * exist because that guarantee is invisible in the API's own tests — every direct call in this
 * file *does* choose its own identity, which is precisely the power a browser must not have.
 *
 * Signs in as dev-user-1, then tries to read qa-user-a's data by forging headers.
 */
async function proxyIdentitySection(rosterIdA, importIdA) {
  section('apps/web proxy — identity comes from the session, never from the request');

  if (!WEB) {
    const msg = 'WEB_BASE is not set, so the proxy identity/spoof checks did not run.';
    if (process.env.CI) {
      // Mandatory in CI: a security check that quietly skips is indistinguishable from one that
      // passes, and this is the only place the header-forging defence is exercised.
      console.log(`  FAIL  ${msg} It is required under CI.`);
      fail += 1;
      failures.push({ desc: msg });
      return;
    }
    console.log(`  SKIP  ${msg}`);
    console.log('        Start apps/web (ALLOW_DEV_LOGIN=true) and set WEB_BASE=http://localhost:3000');
    return;
  }

  // Signed out: the proxy must refuse before it ever reaches the API.
  const anonProxy = await web('/api/proxy/rosters');
  ok('signed-out /api/proxy/* returns 401 JSON (not an HTML redirect a fetch() cannot parse)',
    anonProxy.status === 401 && anonProxy.body?.error === 'UNAUTHENTICATED', anonProxy.body);

  // Guards a real regression: with no `authorized` callback, Auth.js defaults to authorized and
  // `export default auth` lets every signed-out page render.
  const anonPage = await web('/leagues');
  ok('signed-out page request redirects to /signin (the `authorized` callback is wired)',
    anonPage.status === 307 && (anonPage.location ?? '').includes('/signin'),
    { status: anonPage.status, location: anonPage.location });

  const jar = await signInAsDevUser();
  const session = await web('/api/auth/session', { jar });
  ok('dev-login establishes a session for dev-user-1',
    session.body?.user?.id === DEV_LOGIN_USER, session.body);

  // The signed-out check above cannot tell a correctly wired `authorized` callback from one
  // hardcoded to false — both redirect. Only this says the gate admits as well as rejects.
  const authedPage = await web('/leagues', { jar });
  ok('signed-in page request renders (200), so the gate admits and does not merely reject',
    authedPage.status === 200, { status: authedPage.status, location: authedPage.location });

  // The honest request: whatever dev-user-1 is allowed to see.
  const honest = await web('/api/proxy/rosters', { jar });
  ok('signed-in proxy request reaches the API (200)', honest.status === 200, honest.body);
  ok('dev-user-1\'s roster list does not contain user A\'s roster',
    Array.isArray(honest.body) && !honest.body.some((r) => r.id === rosterIdA), honest.body);

  // The attack: a signed-in browser forging both headers it must not control.
  const forged = { 'x-user-id': USER_A, 'x-api-key': 'forged-not-the-real-secret' };

  const spoofedList = await web('/api/proxy/rosters', { jar, headers: forged });
  ok('forged x-user-id is overwritten — response is identical to the honest request',
    spoofedList.status === 200 && JSON.stringify(spoofedList.body) === JSON.stringify(honest.body),
    { honest: honest.body, spoofed: spoofedList.body });
  ok('forged x-user-id does not leak user A\'s roster into the list',
    Array.isArray(spoofedList.body) && !spoofedList.body.some((r) => r.id === rosterIdA),
    spoofedList.body);

  // Direct-object reads are the sharper test: the ownership guard must 404, not 403 or 200.
  const spoofedRoster = await web(`/api/proxy/rosters/${rosterIdA}`, { jar, headers: forged });
  ok('forged x-user-id gets 404 reading user A\'s roster through the proxy',
    spoofedRoster.status === 404, spoofedRoster.body);

  const spoofedImport = await web(`/api/proxy/leagues/${LEAGUE_A}/imports/${importIdA}/preview`, { jar, headers: forged });
  ok('forged x-user-id gets 404 reading user A\'s import preview through the proxy',
    spoofedImport.status === 404, spoofedImport.body);
}

async function main() {
  console.log(`Heritage Saturday QA suite — API base: ${BASE}`);
  console.log(`  apps/web base: ${WEB ?? '(not set — proxy identity checks skipped)'}`);

  // -------------------------------------------------------------------
  section('Auth — POST /auth/session establishes identity and must NOT require x-user-id');
  // -------------------------------------------------------------------
  // The one route with no x-user-id: it *mints* the id every other route asserts. Called only
  // by apps/web's Auth.js jwt callback on Google sign-in — a path neither dev-login nor the
  // rest of this suite exercises, so it needs its own check. (Regression: NestMiddleware
  // exclude() did not fire under forRoutes('*'), so /auth/session 401'd on a real login.)
  const noUserSession = await api('POST', '/auth/session', {
    body: { provider: 'google', subject: 'qa-oauth-subject-1', email: 'qa-oauth-1@example.test' },
  });
  ok('POST /auth/session succeeds with NO x-user-id header (200 + userId)',
    noUserSession.status === 200 && typeof noUserSession.body?.userId === 'string',
    noUserSession);
  const sameSession = await api('POST', '/auth/session', {
    body: { provider: 'google', subject: 'qa-oauth-subject-1', email: 'qa-oauth-1@example.test' },
  });
  ok('resolving the same identity is idempotent (same userId)',
    sameSession.status === 200 && sameSession.body?.userId === noUserSession.body?.userId,
    { first: noUserSession.body?.userId, second: sameSession.body?.userId });
  const badSession = await api('POST', '/auth/session', { body: { provider: 'google' } });
  ok('POST /auth/session still validates its body (400 without subject/email)',
    badSession.status === 400, badSession);

  // -------------------------------------------------------------------
  section('Capability 2 — leagues: create + list, and every roster/game nests under one');
  // -------------------------------------------------------------------
  const leagueA = await api('POST', '/leagues', { user: USER_A, body: { name: 'Test League A', size: 8 } });
  ok('POST /leagues creates a league (201) with an id', leagueA.status === 201 && !!leagueA.body.id, leagueA.body);
  ok('a new league reports zero teams', leagueA.body.teamCount === 0, leagueA.body);
  LEAGUE_A = leagueA.body.id;

  const leagueB = await api('POST', '/leagues', { user: USER_B, body: { name: 'Test League B', size: 8 } });
  ok('a second user can create their own league', leagueB.status === 201 && !!leagueB.body.id, leagueB.body);
  LEAGUE_B = leagueB.body.id;

  const badSize = await api('POST', '/leagues', { user: USER_A, body: { name: 'Bad', size: 7 } });
  ok('a non-preset size is rejected (400)', badSize.status === 400, badSize.body);

  const listA = await api('GET', '/leagues', { user: USER_A });
  ok('GET /leagues lists the caller\'s league', listA.status === 200 && listA.body.some((l) => l.id === LEAGUE_A), listA.body);
  ok('GET /leagues does not leak another user\'s league', !listA.body.some((l) => l.id === LEAGUE_B), listA.body);

  const leagueBAsA = await api('GET', `/leagues/${LEAGUE_B}`, { user: USER_A });
  ok('reading another user\'s league detail is 404 (not 403)', leagueBAsA.status === 404, leagueBAsA.body);

  // -------------------------------------------------------------------
  section('Capability 2 — template generation: a fresh league is playable with no import');
  // -------------------------------------------------------------------
  const gen = await api('POST', '/leagues', {
    user: USER_A,
    body: { name: 'Generated League', size: 8, templateKey: 'heritage-classic', seed: 'gen-seed-1' },
  });
  ok('POST /leagues with a templateKey creates a generated league (201)', gen.status === 201, gen.body);
  ok('the generated league reports its full team count', gen.body.teamCount === 8, gen.body);

  const genDetail = await api('GET', `/leagues/${gen.body.id}`, { user: USER_A });
  const genRosterId = genDetail.body.rosters?.[0]?.id;
  ok('the generated league has one system roster holding its teams',
    genDetail.body.rosters?.length === 1 && genDetail.body.rosters[0].teamCount === 8, genDetail.body);

  const genRoster = await api('GET', `/rosters/${genRosterId}`, { user: USER_A });
  const genTeams = genRoster.body.teams ?? [];
  ok('generated teams have branding (name, city, conference, division)',
    genTeams.length === 8 && genTeams.every((t) => t.teamName && t.city && t.conference && t.division), genTeams[0]);

  // Determinism: the same seed regenerates the identical set of team names.
  const gen2 = await api('POST', '/leagues', {
    user: USER_A,
    body: { name: 'Generated League 2', size: 8, templateKey: 'heritage-classic', seed: 'gen-seed-1' },
  });
  const gen2Detail = await api('GET', `/leagues/${gen2.body.id}`, { user: USER_A });
  const gen2Roster = await api('GET', `/rosters/${gen2Detail.body.rosters[0].id}`, { user: USER_A });
  const names1 = genTeams.map((t) => t.teamName).sort();
  const names2 = (gen2Roster.body.teams ?? []).map((t) => t.teamName).sort();
  ok('same seed regenerates identical team names (deterministic)',
    JSON.stringify(names1) === JSON.stringify(names2), { names1, names2 });

  // Every generated team auto-generates a LEGAL depth chart on first read — no import needed.
  const genDc0 = await api('GET', `/depth-charts/${genTeams[0].id}`, { user: USER_A });
  const genDc1 = await api('GET', `/depth-charts/${genTeams[1].id}`, { user: USER_A });
  ok('generated team A depth chart is legal (covers required positions)',
    genDc0.status === 200 && genDc0.body.legal === true && genDc0.body.warnings.length === 0, genDc0.body);
  ok('generated team B depth chart is legal', genDc1.status === 200 && genDc1.body.legal === true, genDc1.body);

  // The payoff: simulate a game between two generated teams with no import at all.
  const genGame = await api('POST', `/leagues/${gen.body.id}/games/simulate`, {
    user: USER_A,
    body: {
      homeTeamId: genTeams[0].id, awayTeamId: genTeams[1].id,
      homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'SPREAD', awayDefArchetype: 'NICKEL_ZONE',
      seed: 'gen-game-1',
    },
  });
  ok('a game between two generated teams simulates to COMPLETE with no import',
    genGame.status === 201 && genGame.body.status === 'COMPLETE', genGame.body);
  const genBox = await api('GET', `/leagues/${gen.body.id}/games/${genGame.body.gameId}/box-score`, { user: USER_A });
  ok('the generated game produces a box score',
    genBox.status === 200 && !!genBox.body.teams?.home && !!genBox.body.teams?.away &&
      genBox.body.playerStats?.home.length > 0, genBox.body);

  // Game Center (broadcast slice 1) — derived server-side from the stored game.
  const gc = genBox.body;
  ok('box score includes a drive-by-drive feed (each drive has an outcome + numeric yards)',
    Array.isArray(gc.drives) && gc.drives.length > 0 &&
      gc.drives.every((d) => typeof d.outcome === 'string' && typeof d.yards === 'number' &&
        (d.side === 'home' || d.side === 'away')),
    gc.drives?.slice(0, 2));
  ok('top performers list a leading passer for each side',
    gc.leaders?.home?.some((p) => p.role === 'PASSING' && p.name) &&
      gc.leaders?.away?.some((p) => p.role === 'PASSING' && p.name),
    gc.leaders);
  ok('the recap names the winning team and reads as a sentence',
    typeof gc.recap === 'string' && gc.recap.length > 10 &&
      (gc.recap.includes(gc.teams.home.teamName) || gc.recap.includes(gc.teams.away.teamName)),
    gc.recap);
  const wp = gc.winProbability;
  const homeWon = gc.finalScore.home > gc.finalScore.away;
  ok('win probability starts at 0.5 and its terminal point matches the actual winner',
    Array.isArray(wp) && wp.length >= 2 && wp[0].homeWinProb === 0.5 &&
      wp[wp.length - 1].homeWinProb === (homeWon ? 1 : 0),
    { first: wp?.[0], last: wp?.[wp.length - 1], homeWon });

  // A generated league must not be playable across leagues: its teams are not in the empty LEAGUE_A.
  const crossLeague = await api('POST', `/leagues/${LEAGUE_A}/games/simulate`, {
    user: USER_A,
    body: {
      homeTeamId: genTeams[0].id, awayTeamId: genTeams[1].id,
      homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3',
    },
  });
  ok('generated teams cannot be played under a different league (400)', crossLeague.status === 400, crossLeague.body);

  // -------------------------------------------------------------------
  section('Team & player pages — detail endpoints with branding, roster, and ratings');
  // -------------------------------------------------------------------
  const teamDetail = await api('GET', `/teams/${genTeams[0].id}`, { user: USER_A });
  ok('GET /teams/:id returns team detail with branding colors (previously unserialized)',
    teamDetail.status === 200 && !!teamDetail.body.primaryColor && !!teamDetail.body.secondaryColor,
    teamDetail.body);
  ok('team detail includes the full roster ordered by jersey number',
    Array.isArray(teamDetail.body.players) && teamDetail.body.players.length >= 21 &&
      teamDetail.body.players.every((p, i, a) => i === 0 || a[i - 1].jerseyNumber <= p.jerseyNumber),
    teamDetail.body.players?.length);

  // Roster rows now carry every rating attribute (for the team page's ratings grid).
  const RATING_KEYS = ['speed', 'strength', 'awareness', 'throwPower', 'throwAccuracy', 'catching',
    'routeRunning', 'carry', 'trucking', 'passBlock', 'runBlock', 'tackle', 'coverage', 'kickPower', 'kickAccuracy'];
  ok('every roster row exposes all rating attribute keys',
    teamDetail.body.players.every((p) => RATING_KEYS.every((k) => k in p)),
    Object.keys(teamDetail.body.players?.[0] ?? {}));
  const qb = teamDetail.body.players.find((p) => p.position === 'QB');
  ok('a QB has position-relevant ratings populated (throwPower/throwAccuracy numbers)',
    !!qb && typeof qb.throwPower === 'number' && typeof qb.throwAccuracy === 'number',
    qb && { thp: qb.throwPower, tha: qb.throwAccuracy });

  // Bands & rivalries: a generated team carries a band profile and one rival.
  ok('team detail includes a band profile (name, style, chant, tradition)',
    !!teamDetail.body.band && !!teamDetail.body.band.name && !!teamDetail.body.band.style &&
      !!teamDetail.body.band.chant && !!teamDetail.body.band.tradition,
    teamDetail.body.band);
  ok('team detail names a rival with a classic-game name',
    !!teamDetail.body.rival && !!teamDetail.body.rival.teamId &&
      teamDetail.body.rival.teamId !== teamDetail.body.id &&
      typeof teamDetail.body.rival.classicGameName === 'string',
    teamDetail.body.rival);
  const rivalDetail = await api('GET', `/teams/${teamDetail.body.rival.teamId}`, { user: USER_A });
  ok('rivalry is symmetric: the rival names this team back with the same classic game',
    rivalDetail.status === 200 && rivalDetail.body.rival?.teamId === teamDetail.body.id &&
      rivalDetail.body.rival?.classicGameName === teamDetail.body.rival.classicGameName,
    rivalDetail.body.rival);

  const aPlayerId = teamDetail.body.players?.[0]?.id;
  const playerDetail = await api('GET', `/players/${aPlayerId}`, { user: USER_A });
  ok('GET /players/:id returns player detail with team and overall rating',
    playerDetail.status === 200 && playerDetail.body.teamName === genTeams[0].teamName &&
      typeof playerDetail.body.overallRating === 'number',
    playerDetail.body);
  ok('player detail exposes rating attributes (generated players are flavored)',
    typeof playerDetail.body.overallRating === 'number' &&
      Object.keys(playerDetail.body).some((k) =>
        ['speed', 'throwPower', 'catching', 'tackle', 'coverage', 'kickPower'].includes(k) &&
        playerDetail.body[k] !== null),
    playerDetail.body);

  // Ownership: user B can reach neither the team nor the player (404, not 403, not data).
  const teamAsB = await api('GET', `/teams/${genTeams[0].id}`, { user: USER_B });
  ok('user B gets 404 reading user A\'s team detail', teamAsB.status === 404, teamAsB.body);
  const playerAsB = await api('GET', `/players/${aPlayerId}`, { user: USER_B });
  ok('user B gets 404 reading user A\'s player detail', playerAsB.status === 404, playerAsB.body);

  // -------------------------------------------------------------------
  section('Schedule & standings — round-robin season, week-by-week, computed standings');
  // -------------------------------------------------------------------
  const GEN = gen.body.id; // the 8-team generated league
  const sched = await api('POST', `/leagues/${GEN}/schedule`, { user: USER_A });
  ok('POST /schedule generates a single round-robin: 7 weeks, 28 games, all PENDING',
    sched.status === 201 && sched.body.weeks.length === 7 &&
      sched.body.weeks.reduce((n, w) => n + w.games.length, 0) === 28 &&
      sched.body.weeks.every((w) => w.games.length === 4 && w.games.every((g) => g.status === 'PENDING')),
    { weeks: sched.body.weeks?.length, next: sched.body.nextWeek });
  ok('a fresh schedule reports nextWeek === 1', sched.body.nextWeek === 1, sched.body.nextWeek);

  // Rivalry-aware scheduling: rival matchups are labeled and placed in the later half.
  const allSchedGames = sched.body.weeks.flatMap((w) => w.games.map((g) => ({ ...g, week: w.week })));
  const rivalryGames = allSchedGames.filter((g) => g.isRivalry);
  ok('the schedule labels the four rival matchups (isRivalry + classicGameName)',
    rivalryGames.length === 4 &&
      rivalryGames.every((g) => g.isHomecoming && typeof g.classicGameName === 'string' && g.classicGameName),
    rivalryGames.map((g) => `w${g.week} ${g.classicGameName}`));
  ok('non-rivalry games carry no rivalry labels',
    allSchedGames.filter((g) => !g.isRivalry).every((g) => !g.isHomecoming && g.classicGameName === null),
    allSchedGames.filter((g) => !g.isRivalry).length);
  ok('rival games are placed in the later half of the 7-week season (weeks > 3.5)',
    rivalryGames.every((g) => g.week > 3.5),
    rivalryGames.map((g) => g.week));

  const regen = await api('POST', `/leagues/${GEN}/schedule`, { user: USER_A });
  ok('regenerating an existing schedule is rejected (409)', regen.status === 409, regen.body);

  const wk1 = await api('POST', `/leagues/${GEN}/schedule/simulate-week`, { user: USER_A });
  const wk1Games = wk1.body.weeks.find((w) => w.week === 1).games;
  ok('simulate-week plays week 1 (4 games COMPLETE with scores) and advances nextWeek to 2',
    wk1.status === 200 && wk1.body.nextWeek === 2 &&
      wk1Games.every((g) => g.status === 'COMPLETE' && g.homeScore !== null && g.awayScore !== null),
    { next: wk1.body.nextWeek });

  const stand1 = await api('GET', `/leagues/${GEN}/standings`, { user: USER_A });
  const allRows1 = stand1.body.groups.flatMap((gr) => gr.rows);
  ok('standings after week 1: 4 teams 1-0 and 4 teams 0-1',
    stand1.status === 200 &&
      allRows1.filter((r) => r.wins === 1 && r.losses === 0).length === 4 &&
      allRows1.filter((r) => r.wins === 0 && r.losses === 1).length === 4,
    allRows1.map((r) => `${r.wins}-${r.losses}`));
  ok('standings differential equals pointsFor - pointsAgainst for every row',
    allRows1.every((r) => r.differential === r.pointsFor - r.pointsAgainst), allRows1[0]);
  ok('standings are grouped by conference/division',
    stand1.body.groups.length >= 1 && stand1.body.groups.every((gr) => gr.conference !== undefined),
    stand1.body.groups.map((gr) => `${gr.conference}/${gr.division}: ${gr.rows.length}`));

  // Play the remaining six weeks.
  for (let w = 2; w <= 7; w++) {
    await api('POST', `/leagues/${GEN}/schedule/simulate-week`, { user: USER_A });
  }
  const done = await api('POST', `/leagues/${GEN}/schedule/simulate-week`, { user: USER_A });
  ok('simulating past the final week is rejected (409 season complete)', done.status === 409, done.body);

  const finalSched = await api('GET', `/leagues/${GEN}/schedule`, { user: USER_A });
  ok('a fully-played season reports nextWeek === null', finalSched.body.nextWeek === null, finalSched.body.nextWeek);

  const standF = await api('GET', `/leagues/${GEN}/standings`, { user: USER_A });
  const allRowsF = standF.body.groups.flatMap((gr) => gr.rows);
  ok('every team has played 7 games (wins + losses === 7) at season end',
    allRowsF.length === 8 && allRowsF.every((r) => r.wins + r.losses === 7),
    allRowsF.map((r) => `${r.wins}-${r.losses}`));

  // Ownership: user B cannot read or drive user A's season.
  const schedAsB = await api('GET', `/leagues/${GEN}/schedule`, { user: USER_B });
  ok('user B gets 404 reading user A\'s schedule', schedAsB.status === 404, schedAsB.body);
  const standAsB = await api('GET', `/leagues/${GEN}/standings`, { user: USER_B });
  ok('user B gets 404 reading user A\'s standings', standAsB.status === 404, standAsB.body);
  const simAsB = await api('POST', `/leagues/${GEN}/schedule/simulate-week`, { user: USER_B });
  ok('user B gets 404 trying to simulate user A\'s season', simAsB.status === 404, simAsB.body);

  // -------------------------------------------------------------------
  section('Multi-user leagues — membership + LEAGUE visibility grants member read access');
  // -------------------------------------------------------------------
  const B_EMAIL = 'qa-b@heritage-saturday.local'; // qa-user-b's seeded email
  const P = genTeams[0].id; // a team in GEN; aPlayerId is one of its players

  // Before membership, B (a stranger to this league) sees nothing.
  ok('non-member gets 404 on the league', (await api('GET', `/leagues/${GEN}`, { user: USER_B })).status === 404);
  ok('non-member gets 404 on a roster', (await api('GET', `/rosters/${genRosterId}`, { user: USER_B })).status === 404);
  ok('non-member gets 404 on a team', (await api('GET', `/teams/${P}`, { user: USER_B })).status === 404);
  ok('non-member gets 404 on a player', (await api('GET', `/players/${aPlayerId}`, { user: USER_B })).status === 404);

  // Owner adds B as a member by email.
  const add = await api('POST', `/leagues/${GEN}/members`, { user: USER_A, body: { email: B_EMAIL } });
  ok('owner adds a member by email (200, default role VIEWER)', add.status === 200 && add.body.role === 'VIEWER', add.body);
  const membersList = await api('GET', `/leagues/${GEN}/members`, { user: USER_A });
  ok('members list shows the owner first, then the new member',
    membersList.body[0]?.role === 'OWNER' && membersList.body.some((m) => m.email === B_EMAIL), membersList.body);
  ok('adding an unknown email is rejected (404)',
    (await api('POST', `/leagues/${GEN}/members`, { user: USER_A, body: { email: 'nobody@nowhere.test' } })).status === 404);

  // A member can see the league SHELL, but PRIVATE rosters are still hidden until promoted.
  const leagueAsMemberBefore = await api('GET', `/leagues/${GEN}`, { user: USER_B });
  ok('member can now read the league shell (200)', leagueAsMemberBefore.status === 200, leagueAsMemberBefore.status);
  ok('member sees no rosters while all are PRIVATE', leagueAsMemberBefore.body.rosters.length === 0, leagueAsMemberBefore.body.rosters);
  ok('member still gets 404 on a PRIVATE roster', (await api('GET', `/rosters/${genRosterId}`, { user: USER_B })).status === 404);
  ok('GET /leagues as the member lists the shared league tagged with the member\'s role',
    (await api('GET', '/leagues', { user: USER_B })).body.some((l) => l.id === GEN && l.role === 'VIEWER'));

  // Owner promotes the roster to LEAGUE.
  const promote = await api('PATCH', `/rosters/${genRosterId}/visibility`, { user: USER_A, body: { visibility: 'LEAGUE' } });
  ok('owner promotes a roster to LEAGUE (200)', promote.status === 200 && promote.body.visibility === 'LEAGUE', promote.body);

  // Now the member can read the roster and everything under it.
  ok('member can read the LEAGUE roster', (await api('GET', `/rosters/${genRosterId}`, { user: USER_B })).status === 200);
  ok('member can read a team in it', (await api('GET', `/teams/${P}`, { user: USER_B })).status === 200);
  ok('member can read a player in it', (await api('GET', `/players/${aPlayerId}`, { user: USER_B })).status === 200);
  ok('member can read the depth chart', (await api('GET', `/depth-charts/${P}`, { user: USER_B })).status === 200);
  ok('member can list teams for the LEAGUE roster', (await api('GET', `/teams?rosterId=${genRosterId}`, { user: USER_B })).status === 200);
  const leagueAsMemberAfter = await api('GET', `/leagues/${GEN}`, { user: USER_B });
  ok('the LEAGUE roster now appears in the member\'s league detail', leagueAsMemberAfter.body.rosters.some((r) => r.id === genRosterId), leagueAsMemberAfter.body.rosters);

  // A different user who is NOT a member still gets nothing, even though the roster is LEAGUE.
  ok('a non-member gets 404 on the LEAGUE roster', (await api('GET', `/rosters/${genRosterId}`, { user: DEV_LOGIN_USER })).status === 404);

  // A VIEWER member can read but performs no mutations: 403 (a member, told they lack the role)
  // rather than 404 (which is reserved for hiding a league's existence from non-members).
  ok('VIEWER cannot change visibility (403)',
    (await api('PATCH', `/rosters/${genRosterId}/visibility`, { user: USER_B, body: { visibility: 'PRIVATE' } })).status === 403);
  ok('VIEWER cannot add members (403)',
    (await api('POST', `/leagues/${GEN}/members`, { user: USER_B, body: { email: 'x@y.test' } })).status === 403);
  ok('VIEWER cannot import (403)',
    (await api('GET', `/leagues/${GEN}/imports`, { user: USER_B })).status === 403);
  ok('VIEWER cannot simulate (403)',
    (await api('POST', `/leagues/${GEN}/games/simulate`, { user: USER_B, body: { homeTeamId: P, awayTeamId: genTeams[1].id, homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3', awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3' } })).status === 403);
  // But a VIEWER CAN read the season (schedule/standings are league content).
  ok('VIEWER can read the schedule', (await api('GET', `/leagues/${GEN}/schedule`, { user: USER_B })).status === 200);
  ok('VIEWER can read the standings', (await api('GET', `/leagues/${GEN}/standings`, { user: USER_B })).status === 200);

  // -------------------------------------------------------------------
  section('League roles — capability boundaries per role (Manager, Commissioner)');
  // -------------------------------------------------------------------
  // Promote B to MANAGER: content operations, but not the season or membership.
  const toManager = await api('PATCH', `/leagues/${GEN}/members/${USER_B}`, { user: USER_A, body: { role: 'MANAGER' } });
  ok('owner sets a member\'s role to MANAGER (200)', toManager.status === 200 && toManager.body.role === 'MANAGER', toManager.body);
  ok('MANAGER can change roster visibility',
    (await api('PATCH', `/rosters/${genRosterId}/visibility`, { user: USER_B, body: { visibility: 'LEAGUE' } })).status === 200);
  ok('MANAGER can read import history (a content view)',
    (await api('GET', `/leagues/${GEN}/imports`, { user: USER_B })).status === 200);
  ok('MANAGER still cannot simulate (403)',
    (await api('POST', `/leagues/${GEN}/games/simulate`, { user: USER_B, body: { homeTeamId: P, awayTeamId: genTeams[1].id, homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3', awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3' } })).status === 403);
  ok('MANAGER still cannot manage members (403)',
    (await api('PATCH', `/leagues/${GEN}/members/${USER_A}`, { user: USER_B, body: { role: 'VIEWER' } })).status === 403);

  // Promote B to COMMISSIONER: runs the league, but membership stays owner-only.
  ok('owner sets a member\'s role to COMMISSIONER (200)',
    (await api('PATCH', `/leagues/${GEN}/members/${USER_B}`, { user: USER_A, body: { role: 'COMMISSIONER' } })).status === 200);
  ok('COMMISSIONER can simulate a game',
    (await api('POST', `/leagues/${GEN}/games/simulate`, { user: USER_B, body: { homeTeamId: P, awayTeamId: genTeams[1].id, homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3', awayOffArchetype: 'SPREAD', awayDefArchetype: 'NICKEL_ZONE' } })).status === 201);
  ok('COMMISSIONER still cannot manage members (403)',
    (await api('POST', `/leagues/${GEN}/members`, { user: USER_B, body: { email: 'x@y.test' } })).status === 403);

  // An invalid role value is rejected.
  ok('setting an invalid role is rejected (400)',
    (await api('PATCH', `/leagues/${GEN}/members/${USER_B}`, { user: USER_A, body: { role: 'OWNER' } })).status === 400);
  // A non-member cannot be a target of role change (404).
  ok('setting the role of a non-member is 404',
    (await api('PATCH', `/leagues/${GEN}/members/${DEV_LOGIN_USER}`, { user: USER_A, body: { role: 'MANAGER' } })).status === 404);
  // A non-member still gets 404 (existence hidden), not 403, on a mutation.
  ok('a non-member gets 404 (not 403) trying to simulate',
    (await api('POST', `/leagues/${GEN}/games/simulate`, { user: DEV_LOGIN_USER, body: { homeTeamId: P, awayTeamId: genTeams[1].id, homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3', awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3' } })).status === 404);

  // Removing the member revokes access.
  ok('owner removes the member (204)', (await api('DELETE', `/leagues/${GEN}/members/${USER_B}`, { user: USER_A })).status === 204);
  ok('the removed member gets 404 on the (still LEAGUE) roster again',
    (await api('GET', `/rosters/${genRosterId}`, { user: USER_B })).status === 404);

  // -------------------------------------------------------------------
  section('League invitations — invite, inbox, accept/decline, revoke');
  // -------------------------------------------------------------------
  const B_MAIL = 'qa-b@heritage-saturday.local';
  const DEV_MAIL = 'dev@heritage-saturday.local';

  // Owner invites B (COMMISSIONER). B is not a member until they accept.
  const invite = await api('POST', `/leagues/${GEN}/invitations`, { user: USER_A, body: { email: B_MAIL, role: 'COMMISSIONER' } });
  ok('owner creates an invitation (200, PENDING)', invite.status === 200 && invite.body.status === 'PENDING' && invite.body.role === 'COMMISSIONER', invite.body);
  ok('inviting does NOT make them a member yet',
    (await api('GET', `/rosters/${genRosterId}`, { user: USER_B })).status === 404);

  ok('the league\'s invitation list shows the pending invite',
    (await api('GET', `/leagues/${GEN}/invitations`, { user: USER_A })).body.some((i) => i.email === B_MAIL), null);

  // Invitee inbox is scoped to the caller's own email.
  const bInbox = await api('GET', '/invitations', { user: USER_B });
  ok('B\'s inbox lists the invitation with the league name', bInbox.status === 200 && bInbox.body.some((i) => i.id === invite.body.id && i.leagueName), bInbox.body);
  ok('the owner\'s inbox does NOT show an invite addressed to a different email',
    (await api('GET', '/invitations', { user: USER_A })).body.every((i) => i.email !== B_MAIL));

  // Cannot accept an invitation that is not yours.
  ok('accepting a non-existent invitation is 404', (await api('POST', `/invitations/does-not-exist/accept`, { user: USER_B })).status === 404);
  ok('a different user cannot accept B\'s invitation (404, not disclosed)',
    (await api('POST', `/invitations/${invite.body.id}/accept`, { user: DEV_LOGIN_USER })).status === 404);

  // B accepts → becomes a member with the invited role.
  const accept = await api('POST', `/invitations/${invite.body.id}/accept`, { user: USER_B });
  ok('B accepts the invitation (200) and it returns the league', accept.status === 200 && accept.body.leagueId === GEN, accept.body);
  ok('B is now a member and can read the LEAGUE roster', (await api('GET', `/rosters/${genRosterId}`, { user: USER_B })).status === 200);
  ok('B\'s league role reflects the invited COMMISSIONER',
    (await api('GET', '/leagues', { user: USER_B })).body.some((l) => l.id === GEN && l.role === 'COMMISSIONER'));
  ok('accepting an already-accepted invitation is 409', (await api('POST', `/invitations/${invite.body.id}/accept`, { user: USER_B })).status === 409);
  ok('B\'s inbox no longer lists the accepted invite', (await api('GET', '/invitations', { user: USER_B })).body.every((i) => i.id !== invite.body.id));

  // Re-inviting an existing member is rejected.
  ok('inviting someone already a member is 409',
    (await api('POST', `/leagues/${GEN}/invitations`, { user: USER_A, body: { email: B_MAIL } })).status === 409);

  // A commissioner cannot invite (members:manage is owner-only).
  ok('a commissioner cannot create invitations (403)',
    (await api('POST', `/leagues/${GEN}/invitations`, { user: USER_B, body: { email: 'x@y.test' } })).status === 403);

  // Invite a not-yet-registered email: allowed and PENDING, but invisible to unrelated users.
  const newbie = await api('POST', `/leagues/${GEN}/invitations`, { user: USER_A, body: { email: 'newbie@nowhere.test', role: 'MANAGER' } });
  ok('inviting a not-yet-registered email is accepted (PENDING)', newbie.status === 200 && newbie.body.status === 'PENDING', newbie.body);
  ok('that invite is absent from B\'s inbox (different email)',
    (await api('GET', '/invitations', { user: USER_B })).body.every((i) => i.email !== 'newbie@nowhere.test'));
  // Revoke it.
  ok('owner revokes a pending invitation (204)', (await api('DELETE', `/leagues/${GEN}/invitations/${newbie.body.id}`, { user: USER_A })).status === 204);
  ok('the revoked invite is gone from the league list',
    (await api('GET', `/leagues/${GEN}/invitations`, { user: USER_A })).body.every((i) => i.id !== newbie.body.id));

  // Decline path: invite dev-user-1, who declines from their inbox.
  const devInv = await api('POST', `/leagues/${GEN}/invitations`, { user: USER_A, body: { email: DEV_MAIL, role: 'VIEWER' } });
  ok('dev-user-1\'s inbox shows the invite', (await api('GET', '/invitations', { user: DEV_LOGIN_USER })).body.some((i) => i.id === devInv.body.id), null);
  ok('dev-user-1 declines the invite (204)', (await api('POST', `/invitations/${devInv.body.id}/decline`, { user: DEV_LOGIN_USER })).status === 204);
  ok('declining does not make them a member',
    (await api('GET', `/rosters/${genRosterId}`, { user: DEV_LOGIN_USER })).status === 404);
  ok('a declined invite is gone from the inbox', (await api('GET', '/invitations', { user: DEV_LOGIN_USER })).body.every((i) => i.id !== devInv.body.id));

  // -------------------------------------------------------------------
  section('Story 1.1 / 1.5 / 1.8 — valid CSV import: preview + commit + history');
  // -------------------------------------------------------------------
  const validCsv = await uploadAndCommit(USER_A, 'valid-roster.csv', 'valid csv');
  ok('upload returns 201 with PENDING status', validCsv.upload.status === 201 && validCsv.upload.body.status === 'PENDING', validCsv.upload);
  ok('preview lists every row with OK/WARNING/ERROR status', validCsv.preview.status === 200 &&
      validCsv.preview.body.rows.length > 0 &&
      validCsv.preview.body.rows.every((r) => ['OK', 'WARNING', 'ERROR'].includes(r.status)),
    validCsv.preview.body);
  ok('preview rows are all OK for a fully valid file', validCsv.preview.body.rows.every((r) => r.status === 'OK'),
    validCsv.preview.body.rows.filter((r) => r.status !== 'OK'));
  ok('commit returns 200 with rosterId + summary', validCsv.commit.status === 200 && !!validCsv.commit.body.rosterId, validCsv.commit.body);
  const expectedCreated = 2 /* teams */ + 40 /* players, 20 per team */;
  ok(`commit summary created count reflects committed rows (expected ${expectedCreated})`,
    validCsv.commit.body.summary.created === expectedCreated, validCsv.commit.body.summary);
  const rosterIdA = validCsv.commit.body.rosterId;

  const history = await api('GET', `/leagues/${LEAGUE_A}/imports`, { user: USER_A });
  ok('import history lists the import with fileName/date/summary', history.status === 200 &&
      history.body.some((i) => i.importId === validCsv.importId && i.fileName === 'valid-roster.csv' && i.summary.created === expectedCreated),
    history.body);

  // -------------------------------------------------------------------
  section('Story 1.1 — valid JSON import produces preview with all rows OK');
  // -------------------------------------------------------------------
  const validJson = await uploadAndCommit(USER_A, 'valid-roster.json', 'valid json');
  ok('JSON upload accepted (201)', validJson.upload.status === 201, validJson.upload);
  ok('JSON preview rows all OK', validJson.preview.body.rows.every((r) => r.status === 'OK'),
    validJson.preview.body.rows.filter((r) => r.status !== 'OK'));
  ok('JSON commit succeeds', validJson.commit.status === 200, validJson.commit.body);

  // -------------------------------------------------------------------
  section('Story 1.2 — missing required column (position) -> ERROR, cannot commit those rows');
  // -------------------------------------------------------------------
  const missingCol = await uploadAndCommit(USER_A, 'missing-column.csv', 'missing column');
  const missingColRow = missingCol.preview.body.rows.find((r) => r.sheet === 'players' && r.data.player_id === 'T1-P1');
  ok('row with missing position is flagged ERROR', missingColRow?.status === 'ERROR', missingColRow);
  ok('ERROR message names the missing field', missingColRow?.messages.some((m) => /position/i.test(m)), missingColRow?.messages);
  ok('commit succeeds but excludes the ERROR row (failed count > 0)', missingCol.commit.status === 200 && missingCol.commit.body.summary.failed > 0, missingCol.commit.body);

  // -------------------------------------------------------------------
  section('Story 1.2 (Teams) — missing team_name -> ERROR');
  // -------------------------------------------------------------------
  const missingTeamName = await uploadAndCommit(USER_A, 'missing-team-name.csv', 'missing team_name');
  const missingTeamRow = missingTeamName.preview.body.rows.find((r) => r.sheet === 'teams' && r.data.team_id === 'T2');
  ok('team row with missing team_name is flagged ERROR', missingTeamRow?.status === 'ERROR', missingTeamRow);
  ok('ERROR message names team_name', missingTeamRow?.messages.some((m) => /team_name/i.test(m)), missingTeamRow?.messages);

  // -------------------------------------------------------------------
  section('Story 1.3 — duplicate player_id -> ERROR, excluded from commit');
  // -------------------------------------------------------------------
  const dupPlayerId = await uploadAndCommit(USER_A, 'duplicate-player-id.csv', 'dup player_id');
  const dupRows = dupPlayerId.preview.body.rows.filter((r) => r.sheet === 'players' && r.data.player_id === 'T1-P1');
  ok('both rows sharing the duplicated player_id are flagged ERROR', dupRows.length === 2 && dupRows.every((r) => r.status === 'ERROR'), dupRows);
  ok('duplicate player_id ERROR message mentions duplicate', dupRows.every((r) => r.messages.some((m) => /duplicate/i.test(m))), dupRows.map(r=>r.messages));

  // -------------------------------------------------------------------
  section('Story 1.3 — duplicate jersey number within same team_id -> ERROR');
  // -------------------------------------------------------------------
  const dupJersey = await uploadAndCommit(USER_A, 'duplicate-jersey.csv', 'dup jersey');
  const dupJerseyRows = dupJersey.preview.body.rows.filter((r) => r.sheet === 'players' && r.data.team_id === 'T1' && Number(r.data.jersey_number) === 1);
  ok('both rows sharing the duplicated jersey are flagged ERROR', dupJerseyRows.length === 2 && dupJerseyRows.every((r) => r.status === 'ERROR'), dupJerseyRows);

  // -------------------------------------------------------------------
  section('Story 1.4 — out-of-range rating + invalid position -> ERROR');
  // -------------------------------------------------------------------
  const badRatingPos = await uploadAndCommit(USER_A, 'bad-rating-invalid-position.csv', 'bad rating/position');
  const badRatingRow = badRatingPos.preview.body.rows.find((r) => r.sheet === 'players' && r.data.player_id === 'T1-P3');
  const badPosRow = badRatingPos.preview.body.rows.find((r) => r.sheet === 'players' && r.data.player_id === 'T1-P4');
  ok('out-of-range overall_rating (150) flagged ERROR', badRatingRow?.status === 'ERROR', badRatingRow);
  ok('invalid position code (ZZ) flagged ERROR', badPosRow?.status === 'ERROR', badPosRow);

  // -------------------------------------------------------------------
  section('Story 1.7 — unsupported extension / corrupt content -> top-level error, no partial import');
  // -------------------------------------------------------------------
  const unsupported = await api('POST', `/leagues/${LEAGUE_A}/imports/roster`, { user: USER_A, file: readFixture('unsupported.txt'), fileName: 'unsupported.txt' });
  ok('unsupported extension returns 422 with topLevelError', unsupported.status === 422 && !!unsupported.body.detail?.topLevelError, unsupported.body);
  const rostersBeforeCorrupt = await api('GET', '/rosters', { user: USER_A });
  const corrupt = await api('POST', `/leagues/${LEAGUE_A}/imports/roster`, { user: USER_A, file: readFixture('corrupt.xlsx'), fileName: 'corrupt.xlsx' });
  // SheetJS's XLSX.read() parses arbitrary bytes without throwing, so parseXlsx guards on
  // "at least one recognized roster sheet carrying at least one data row" — otherwise garbage
  // would land as a silently-successful empty import. Story 1 AC7.
  ok('corrupt xlsx content returns 422 with a topLevelError (Story 1 AC7)',
    corrupt.status === 422 && !!corrupt.body.detail?.topLevelError, corrupt.body);
  ok('the corrupt-xlsx error names the parse failure rather than a generic 500',
    /roster sheets|data rows|workbook/i.test(corrupt.body.detail?.topLevelError ?? ''), corrupt.body);
  ok('no importId is handed back for a rejected file', !corrupt.body.importId, corrupt.body);

  const rostersAfterCorrupt = await api('GET', '/rosters', { user: USER_A });
  // GET /rosters returns a bare array; guard against both sides being undefined,
  // which would make this comparison vacuously true.
  ok('rejected corrupt file creates no partial import (roster count unchanged)',
    Array.isArray(rostersBeforeCorrupt.body) && Array.isArray(rostersAfterCorrupt.body) &&
      rostersAfterCorrupt.body.length === rostersBeforeCorrupt.body.length,
    { before: rostersBeforeCorrupt.body?.length, after: rostersAfterCorrupt.body?.length });

  // -------------------------------------------------------------------
  section('Story 1 AC10-14 — orphan player is WARNING, dropped, and counted as skipped');
  // -------------------------------------------------------------------
  const orphan = await uploadAndCommit(USER_A, 'orphan-player.csv', 'orphan player');
  const orphanRows = orphan.preview.body.rows.filter((r) => r.sheet === 'players');
  const orphanRow = orphanRows.find((r) => r.data?.player_id === 'T9-P1' || r.data?.team_id === 'T9');
  const goodRows = orphanRows.filter((r) => r !== orphanRow);

  ok('AC10: orphan player row previews as WARNING', orphanRow?.status === 'WARNING', orphanRow);
  ok('AC10: WARNING message says the player will not be created',
    /does not match any team in this import/.test(orphanRow?.messages?.[0] ?? '') &&
      /will not be created/.test(orphanRow?.messages?.[0] ?? ''), orphanRow?.messages);
  ok('AC14: non-orphan player rows remain OK', goodRows.length === 2 && goodRows.every((r) => r.status === 'OK'),
    goodRows.map((r) => r.status));

  // Preview projection: 1 team + 2 committable players = 3 created; orphan projected as skipped.
  ok('preview summary projects created=3 (1 team + 2 players), excluding the orphan',
    orphan.preview.body.summary.created === 3, orphan.preview.body.summary);
  ok('preview summary projects the orphan as skipped, not created or failed',
    orphan.preview.body.summary.skipped === 1 && orphan.preview.body.summary.failed === 0,
    orphan.preview.body.summary);

  ok('AC12(a): commit succeeds despite the WARNING row', orphan.commit.status === 200, orphan.commit.body);
  const orphanSummary = orphan.commit.body.summary;
  ok('AC12(c): commit summary created=3 does not include the dropped orphan',
    orphanSummary.created === 3, orphanSummary);
  ok('AC12(d): commit summary counts the dropped orphan as skipped',
    orphanSummary.skipped === 1, orphanSummary);
  ok('AC12(e): the orphan is not counted as failed', orphanSummary.failed === 0, orphanSummary);
  // Regression: previously a dropped orphan landed in no bucket at all.
  ok('every entity row lands in exactly one bucket (created+skipped+failed === 4 rows)',
    orphanSummary.created + orphanSummary.skipped + orphanSummary.failed === 4, orphanSummary);

  const orphanRoster = await api('GET', `/rosters/${orphan.commit.body.rosterId}`, { user: USER_A });
  const orphanTeam = orphanRoster.body.teams?.[0];
  const orphanTeamPlayers = await api('GET', `/teams/${orphanTeam?.id}/players`, { user: USER_A });
  const playerNames = (orphanTeamPlayers.body ?? []).map((p) => p.lastName ?? p.last_name);
  ok('AC12(b): only one team was created (T9 never existed)', orphanRoster.body.teams?.length === 1, orphanRoster.body.teams?.length);
  ok('AC12(b): the orphan player was NOT persisted', !playerNames.includes('Vance'), playerNames);
  ok('AC12(b): the two linked players WERE persisted', playerNames.includes('Fenwick') && playerNames.includes('Alder'), playerNames);

  // -------------------------------------------------------------------
  section('Orphan coaches + depth-chart rows — WARNING, dropped, counted as skipped');
  // -------------------------------------------------------------------
  const orphan2 = await uploadAndCommit(USER_A, 'orphan-coach-depthchart.csv', 'orphan coach/depthchart');
  const rowsOf = (sheet) => orphan2.preview.body.rows.filter((r) => r.sheet === sheet);

  const coachRows = rowsOf('coaches');
  const orphanCoach = coachRows.find((r) => r.data?.team_id === 'T9');
  const linkedCoach = coachRows.find((r) => r.data?.team_id === 'T1');
  ok('orphan coach previews as WARNING', orphanCoach?.status === 'WARNING', orphanCoach);
  ok('orphan coach message says the coach will not be created',
    /this coach will not be created/.test(orphanCoach?.messages?.[0] ?? ''), orphanCoach?.messages);
  ok('linked coach stays OK', linkedCoach?.status === 'OK', linkedCoach);

  const dcRows = rowsOf('depthchart');
  ok('both depth-chart rows for the missing team preview as WARNING',
    dcRows.length === 2 && dcRows.every((r) => r.status === 'WARNING'), dcRows.map((r) => r.status));
  ok('depth-chart WARNING names the missing team as the root cause',
    dcRows.every((r) => /does not match any team in this import/.test(r.messages?.[0] ?? '')),
    dcRows.map((r) => r.messages));

  ok('commit succeeds', orphan2.commit.status === 200, orphan2.commit.body);
  const s2 = orphan2.commit.body.summary;
  ok('commit created=4 (1 team + 2 players + 1 linked coach)', s2.created === 4, s2);
  ok('commit skipped=3 (1 orphan coach + 2 orphan depth-chart rows)', s2.skipped === 3, s2);
  ok('commit failed=0 (orphans are unlinked, not invalid)', s2.failed === 0, s2);
  ok('every entity row lands in exactly one bucket (4+3+0 === 7 rows)',
    s2.created + s2.skipped + s2.failed === 7, s2);

  ok('preview projection agrees with the committed summary',
    orphan2.preview.body.summary.created === s2.created &&
      orphan2.preview.body.summary.skipped === s2.skipped &&
      orphan2.preview.body.summary.failed === s2.failed,
    { preview: orphan2.preview.body.summary, commit: s2 });

  const roster2 = await api('GET', `/rosters/${orphan2.commit.body.rosterId}`, { user: USER_A });
  ok('only the one real team was created', roster2.body.teams?.length === 1, roster2.body.teams?.length);

  // -------------------------------------------------------------------
  section('Import summary counts depth-chart ENTRIES, not charts (rows-vs-charts unit fix)');
  // -------------------------------------------------------------------
  const dcImport = await uploadAndCommit(USER_A, 'complete-depthchart.csv', 'complete depth chart');
  ok('complete-depthchart import commits', dcImport.commit.status === 200, dcImport.commit.body);

  const dcSummary = dcImport.commit.body.summary;
  // 1 team + 20 players + 20 depth-chart entries. Counting charts would give 22.
  ok('commit created=41 counts each depth-chart entry, not the single chart',
    dcSummary.created === 41, dcSummary);
  ok('commit skipped=0 and failed=0 for a fully-linked complete chart',
    dcSummary.skipped === 0 && dcSummary.failed === 0, dcSummary);
  ok('every entity row lands in exactly one bucket (41 rows)',
    dcSummary.created + dcSummary.skipped + dcSummary.failed === 41, dcSummary);

  ok('preview projection agrees exactly with the committed summary',
    dcImport.preview.body.summary.created === dcSummary.created &&
      dcImport.preview.body.summary.skipped === dcSummary.skipped &&
      dcImport.preview.body.summary.failed === dcSummary.failed,
    { preview: dcImport.preview.body.summary, commit: dcSummary });

  // The imported chart must actually be used, not silently regenerated.
  const dcRoster = await api('GET', `/rosters/${dcImport.commit.body.rosterId}`, { user: USER_A });
  const dcTeamId = dcRoster.body.teams?.[0]?.id;
  const importedChart = await api('GET', `/depth-charts/${dcTeamId}`, { user: USER_A });
  ok('the committed depth chart is IMPORTED, not AUTO_GENERATED',
    importedChart.body?.source === 'IMPORTED', importedChart.body?.source);
  ok('the imported chart has all 20 entries and is legal',
    importedChart.body?.entries?.length === 20 && importedChart.body?.legal === true,
    { entries: importedChart.body?.entries?.length, legal: importedChart.body?.legal });

  // -------------------------------------------------------------------
  section('Incomplete depth chart — rows are WARNING, skipped, and chart is auto-generated');
  // -------------------------------------------------------------------
  const incDc = await uploadAndCommit(USER_A, 'incomplete-depthchart.csv', 'incomplete depth chart');
  const incDcRows = incDc.preview.body.rows.filter((r) => r.sheet === 'depthchart');
  // References all resolve, so these are not orphans — but the chart cannot cover the
  // required lineup, so commit discards it. The user is told, rather than silently losing
  // the chart they hand-built.
  ok('incomplete-chart rows are WARNING, not silently OK',
    incDcRows.length === 5 && incDcRows.every((r) => r.status === 'WARNING'), incDcRows.map((r) => r.status));
  ok('the WARNING names the missing required positions and the auto-generation fallback',
    /missing required position\(s\):/.test(incDcRows[0]?.messages?.[0] ?? '') &&
      /auto-generated instead/.test(incDcRows[0]?.messages?.[0] ?? ''), incDcRows[0]?.messages);
  ok('the incomplete-chart WARNING is not an orphan message',
    !/does not match any/.test(incDcRows[0]?.messages?.[0] ?? ''), incDcRows[0]?.messages);

  ok('commit succeeds', incDc.commit.status === 200, incDc.commit.body);
  const incSummary = incDc.commit.body.summary;
  ok('commit created=21 (1 team + 20 players); no depth-chart entries written',
    incSummary.created === 21, incSummary);
  ok('the 5 dropped depth-chart rows are counted as skipped',
    incSummary.skipped === 5, incSummary);
  ok('every entity row lands in exactly one bucket (26 rows)',
    incSummary.created + incSummary.skipped + incSummary.failed === 26, incSummary);
  ok('preview projection agrees with the committed summary',
    incDc.preview.body.summary.created === incSummary.created &&
      incDc.preview.body.summary.skipped === incSummary.skipped,
    { preview: incDc.preview.body.summary, commit: incSummary });

  // The dropped chart must fall back to auto-generation, per architecture §5.
  const incRoster = await api('GET', `/rosters/${incDc.commit.body.rosterId}`, { user: USER_A });
  const incChart = await api('GET', `/depth-charts/${incRoster.body.teams?.[0]?.id}`, { user: USER_A });
  ok('an incomplete imported chart falls back to AUTO_GENERATED',
    incChart.body?.source === 'AUTO_GENERATED', incChart.body?.source);

  // -------------------------------------------------------------------
  section('Depth-chart completeness is judged on rows that will actually be written');
  // -------------------------------------------------------------------
  // All 20 required positions appear among the rows, but the QB row references a player
  // that does not exist. Judging completeness before dropping undeliverable rows would
  // persist an "IMPORTED" chart with no QB, which getOrGenerate then regenerates anyway.
  const phantom = await uploadAndCommit(USER_A, 'depthchart-phantom-qb.csv', 'phantom QB');
  const phantomDc = phantom.preview.body.rows.filter((r) => r.sheet === 'depthchart');
  const phantomQbRow = phantomDc.find((r) => r.data?.player_id === 'T1-P99');
  ok('the row referencing a nonexistent player is WARNING (orphan)',
    phantomQbRow?.status === 'WARNING' && /player_id "T1-P99"/.test(phantomQbRow?.messages?.[0] ?? ''),
    phantomQbRow);
  // Dropping the orphaned QB row leaves the chart without a QB, so the surviving 19 rows
  // are discarded too — and now say so, naming QB as the missing position.
  const phantomSurvivors = phantomDc.filter((r) => r !== phantomQbRow);
  ok('the other 19 rows are WARNING because the chart loses its QB',
    phantomSurvivors.length === 19 && phantomSurvivors.every((r) => r.status === 'WARNING'),
    phantomSurvivors.map((r) => r.status));
  ok('their WARNING names QB as the missing required position',
    phantomSurvivors.every((r) => /missing required position\(s\): QB/.test(r.messages?.[0] ?? '')),
    phantomSurvivors[0]?.messages);

  ok('commit succeeds', phantom.commit.status === 200, phantom.commit.body);
  const ps = phantom.commit.body.summary;
  ok('no partial chart is written: created=21 (1 team + 20 players), 0 depth-chart entries',
    ps.created === 21, ps);
  ok('all 20 depth-chart rows are counted as skipped', ps.skipped === 20, ps);
  ok('every entity row lands in exactly one bucket (41 rows)',
    ps.created + ps.skipped + ps.failed === 41, ps);
  ok('preview projection agrees with the committed summary',
    phantom.preview.body.summary.created === ps.created &&
      phantom.preview.body.summary.skipped === ps.skipped,
    { preview: phantom.preview.body.summary, commit: ps });

  const phantomRoster = await api('GET', `/rosters/${phantom.commit.body.rosterId}`, { user: USER_A });
  const phantomChart = await api('GET', `/depth-charts/${phantomRoster.body.teams?.[0]?.id}`, { user: USER_A });
  ok('the chart falls back to AUTO_GENERATED rather than persisting a QB-less IMPORTED chart',
    phantomChart.body?.source === 'AUTO_GENERATED', phantomChart.body?.source);
  ok('the auto-generated chart is legal and fills QB',
    phantomChart.body?.legal === true &&
      phantomChart.body?.entries?.some((e) => e.position === 'QB'),
    { legal: phantomChart.body?.legal });

  // -------------------------------------------------------------------
  section('Story 1.9 — downloadable blank template (spec requires at least one format)');
  // -------------------------------------------------------------------
  console.log('  NOT-VERIFIED  No template-download route found in architecture.md §4 route list or in apps/api controllers — see report.');

  // -------------------------------------------------------------------
  section('Story 1.6 / architecture §8 — private-by-default ownership, cross-user isolation');
  // -------------------------------------------------------------------
  // USER_B reaches for USER_A's import through USER_A's league — the league guard 404s before
  // the import is even resolved, which is the isolation we want.
  const previewAsB = await api('GET', `/leagues/${LEAGUE_A}/imports/${validCsv.importId}/preview`, { user: USER_B });
  ok('user B gets 404 (not data, not 403) reading user A\'s import', previewAsB.status === 404, previewAsB.body);

  const rosterDetailAsB = await api('GET', `/rosters/${rosterIdA}`, { user: USER_B });
  ok('user B gets 404 reading user A\'s roster detail', rosterDetailAsB.status === 404, rosterDetailAsB.body);

  const rostersListAsB = await api('GET', '/rosters', { user: USER_B });
  ok('user B\'s roster list does not include user A\'s roster', rostersListAsB.status === 200 && !rostersListAsB.body.some((r) => r.id === rosterIdA), rostersListAsB.body);

  const teamsAsOwnerA = await api('GET', `/rosters/${rosterIdA}`, { user: USER_A });
  const teamIdA1 = teamsAsOwnerA.body?.teams?.[0]?.id;
  if (teamIdA1) {
    const teamsQueryAsB = await api('GET', `/teams?rosterId=${rosterIdA}`, { user: USER_B });
    ok('user B cannot list teams for user A\'s rosterId (404 or empty, not leaked)',
      teamsQueryAsB.status === 404 || (teamsQueryAsB.status === 200 && teamsQueryAsB.body.length === 0), teamsQueryAsB.body);

    const playersAsB = await api('GET', `/teams/${teamIdA1}/players`, { user: USER_B });
    ok('user B gets 404 reading user A\'s team players', playersAsB.status === 404, playersAsB.body);

    const depthChartAsB = await api('GET', `/depth-charts/${teamIdA1}`, { user: USER_B });
    ok('user B gets 404 reading user A\'s depth chart', depthChartAsB.status === 404, depthChartAsB.body);
  } else {
    ok('(setup) could resolve a teamId for cross-user team/player/depth-chart checks', false, teamsAsOwnerA.body);
  }

  // -------------------------------------------------------------------
  section('Roster lifecycle — archive / restore / delete / import rollback');
  // -------------------------------------------------------------------
  // A fresh imported roster (no games) can go through the full lifecycle. Use throwaway imports
  // so rosterIdA (used by the game-setup section) is untouched.
  const lc = await uploadAndCommit(USER_A, 'valid-roster.csv', 'lifecycle');
  const lcRoster = lc.commit.body.rosterId;

  const arch = await api('PATCH', `/rosters/${lcRoster}/archive`, { user: USER_A });
  ok('archive marks the roster archived (200)', arch.status === 200 && arch.body.archived === true, arch.body);
  const detailAfterArchive = await api('GET', `/leagues/${LEAGUE_A}`, { user: USER_A });
  ok('an archived roster is flagged in the league detail', detailAfterArchive.body.rosters.some((r) => r.id === lcRoster && r.archived === true), null);
  ok('the archived roster is still fetchable by id', (await api('GET', `/rosters/${lcRoster}`, { user: USER_A })).status === 200);

  const restore = await api('PATCH', `/rosters/${lcRoster}/restore`, { user: USER_A });
  ok('restore clears the archived flag (200)', restore.status === 200 && restore.body.archived === false, restore.body);

  ok('deleting a fresh roster (no games) is 204', (await api('DELETE', `/rosters/${lcRoster}`, { user: USER_A })).status === 204);
  ok('the deleted roster is gone (404)', (await api('GET', `/rosters/${lcRoster}`, { user: USER_A })).status === 404);

  // A roster whose teams have played games cannot be deleted — archive is the answer.
  ok('deleting a roster with games is 409 ROSTER_HAS_GAMES',
    (await api('DELETE', `/rosters/${genRosterId}`, { user: USER_A })).status === 409);
  ok('archiving a roster with games still works',
    (await api('PATCH', `/rosters/${genRosterId}/archive`, { user: USER_A })).body.archived === true);
  ok('...and restoring it back', (await api('PATCH', `/rosters/${genRosterId}/restore`, { user: USER_A })).body.archived === false);

  // Import rollback: undo a committed import.
  const rb = await uploadAndCommit(USER_A, 'valid-roster.csv', 'rollback');
  const rbRoster = rb.commit.body.rosterId;
  const rollback = await api('POST', `/leagues/${LEAGUE_A}/imports/${rb.importId}/rollback`, { user: USER_A });
  ok('rolling back a committed import is 200', rollback.status === 200, rollback.body);
  ok('the rolled-back import\'s roster is gone', (await api('GET', `/rosters/${rbRoster}`, { user: USER_A })).status === 404);
  ok('the import is re-committable after rollback (preview 200)', (await api('GET', `/leagues/${LEAGUE_A}/imports/${rb.importId}/preview`, { user: USER_A })).body.status === 'PENDING');
  ok('rolling back again is 409 (nothing committed)', (await api('POST', `/leagues/${LEAGUE_A}/imports/${rb.importId}/rollback`, { user: USER_A })).status === 409);

  // A non-member of the league cannot delete its rosters (404 — existence hidden).
  ok('a non-member gets 404 deleting a roster', (await api('DELETE', `/rosters/${genRosterId}`, { user: DEV_LOGIN_USER })).status === 404);

  await proxyIdentitySection(rosterIdA, validCsv.importId);

  // -------------------------------------------------------------------
  section('Story 2 — game setup: team selection, depth chart, archetypes, run game');
  // -------------------------------------------------------------------
  const rosterDetail = await api('GET', `/rosters/${rosterIdA}`, { user: USER_A });
  const teams = rosterDetail.body.teams;
  ok('roster has at least two teams to choose from', teams.length >= 2, teams);
  const [teamA, teamB] = teams;

  const dcA = await api('GET', `/depth-charts/${teamA.id}`, { user: USER_A });
  ok('depth chart auto-generates for team A with all required starting positions filled', dcA.status === 200 && dcA.body.warnings.length === 0, dcA.body);
  const dcB = await api('GET', `/depth-charts/${teamB.id}`, { user: USER_A });
  ok('depth chart auto-generates for team B with all required starting positions filled', dcB.status === 200 && dcB.body.warnings.length === 0, dcB.body);

  const sameTeamTwice = await api('POST', `/leagues/${LEAGUE_A}/games/simulate`, {
    user: USER_A,
    body: {
      homeTeamId: teamA.id, awayTeamId: teamA.id,
      homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3',
    },
  });
  ok('selecting the same team twice is rejected (400)', sameTeamTwice.status === 400, sameTeamTwice.body);

  // Unfillable-roster team, for UNFILLABLE_POSITIONS 422 check
  const unfillable = await uploadAndCommit(USER_A, 'unfillable-roster.csv', 'unfillable roster');
  ok('unfillable-roster import commits (rows are individually valid)', unfillable.commit.status === 200, unfillable.commit.body);
  const unfillableRosterDetail = await api('GET', `/rosters/${unfillable.commit.body.rosterId}`, { user: USER_A });
  const unfillableTeamId = unfillableRosterDetail.body.teams[0]?.id;
  if (unfillableTeamId) {
    const unfillableSim = await api('POST', `/leagues/${LEAGUE_A}/games/simulate`, {
      user: USER_A,
      body: {
        homeTeamId: unfillableTeamId, awayTeamId: teamA.id,
        homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
        awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3',
      },
    });
    ok('unfillable roster returns 422 UNFILLABLE_POSITIONS naming positions', unfillableSim.status === 422 &&
        unfillableSim.body.error === 'UNFILLABLE_POSITIONS' &&
        Array.isArray(unfillableSim.body.detail?.positions) && unfillableSim.body.detail.positions.length > 0,
      unfillableSim.body);
  } else {
    ok('(setup) could resolve unfillable team id', false, unfillableRosterDetail.body);
  }

  const invalidArchetype = await api('POST', `/leagues/${LEAGUE_A}/games/simulate`, {
    user: USER_A,
    body: {
      homeTeamId: teamA.id, awayTeamId: teamB.id,
      homeOffArchetype: 'NOT_A_REAL_ARCHETYPE', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3',
    },
  });
  ok('invalid archetype value rejected (400)', invalidArchetype.status === 400, invalidArchetype.body);

  const runGame = await api('POST', `/leagues/${LEAGUE_A}/games/simulate`, {
    user: USER_A,
    body: {
      homeTeamId: teamA.id, awayTeamId: teamB.id,
      homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'SPREAD', awayDefArchetype: 'NICKEL_ZONE',
      seed: 'qa-fixed-seed-001',
    },
  });
  ok('Run Game with valid teams/archetypes/seed succeeds in one call (no further input)', runGame.status === 201 && runGame.body.status === 'COMPLETE', runGame.body);
  const gameId1 = runGame.body.gameId;

  // Cross-user ownership on games/simulate: user B must not be able to use user A's teams
  const crossOwnerSim = await api('POST', `/leagues/${LEAGUE_B}/games/simulate`, {
    user: USER_B,
    body: {
      homeTeamId: teamA.id, awayTeamId: teamB.id,
      homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'BALANCED', awayDefArchetype: 'BALANCED_4_3',
    },
  });
  ok('user B cannot simulate a game using user A\'s teams (400, not owned)', crossOwnerSim.status === 400, crossOwnerSim.body);

  // -------------------------------------------------------------------
  section('Story 2.5 / Determinism — repeated seed => identical result; different seed => different result');
  // -------------------------------------------------------------------
  const runGameRepeat = await api('POST', `/leagues/${LEAGUE_A}/games/simulate`, {
    user: USER_A,
    body: {
      homeTeamId: teamA.id, awayTeamId: teamB.id,
      homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'SPREAD', awayDefArchetype: 'NICKEL_ZONE',
      seed: 'qa-fixed-seed-001',
    },
  });
  const gameId2 = runGameRepeat.body.gameId;
  ok('repeat run with same seed succeeds', runGameRepeat.status === 201, runGameRepeat.body);

  const box1 = await api('GET', `/leagues/${LEAGUE_A}/games/${gameId1}/box-score`, { user: USER_A });
  const box2 = await api('GET', `/leagues/${LEAGUE_A}/games/${gameId2}/box-score`, { user: USER_A });

  function normalizeForCompare(b) {
    if (!b) return null;
    const { gameId, ...rest } = b; // gameId will differ, everything else must match
    return rest;
  }
  const norm1 = normalizeForCompare(box1.body);
  const norm2 = normalizeForCompare(box2.body);
  ok('same seed produces identical final score', JSON.stringify(norm1?.finalScore) === JSON.stringify(norm2?.finalScore), { a: norm1?.finalScore, b: norm2?.finalScore });
  ok('same seed produces identical quarter-by-quarter line', JSON.stringify(norm1?.quarterByQuarter) === JSON.stringify(norm2?.quarterByQuarter), { a: norm1?.quarterByQuarter, b: norm2?.quarterByQuarter });
  ok('same seed produces identical team stats', JSON.stringify(norm1?.teamStats) === JSON.stringify(norm2?.teamStats), { a: norm1?.teamStats, b: norm2?.teamStats });
  // playerStats arrays may differ in element order per game row insert order; compare as sorted-by-playerId
  function sortedPlayerStats(ps) {
    const clone = { home: [...(ps?.home ?? [])].sort((a, b) => a.playerId.localeCompare(b.playerId)), away: [...(ps?.away ?? [])].sort((a, b) => a.playerId.localeCompare(b.playerId)) };
    return clone;
  }
  ok('same seed produces identical full per-player stat line', JSON.stringify(sortedPlayerStats(norm1?.playerStats)) === JSON.stringify(sortedPlayerStats(norm2?.playerStats)),
    { a: sortedPlayerStats(norm1?.playerStats), b: sortedPlayerStats(norm2?.playerStats) });

  const runGameDiffSeed = await api('POST', `/leagues/${LEAGUE_A}/games/simulate`, {
    user: USER_A,
    body: {
      homeTeamId: teamA.id, awayTeamId: teamB.id,
      homeOffArchetype: 'BALANCED', homeDefArchetype: 'BALANCED_4_3',
      awayOffArchetype: 'SPREAD', awayDefArchetype: 'NICKEL_ZONE',
      seed: 'qa-different-seed-002',
    },
  });
  const box3 = await api('GET', `/leagues/${LEAGUE_A}/games/${runGameDiffSeed.body.gameId}/box-score`, { user: USER_A });
  const different = JSON.stringify(box1.body.finalScore) !== JSON.stringify(box3.body.finalScore) ||
    JSON.stringify(box1.body.quarterByQuarter) !== JSON.stringify(box3.body.quarterByQuarter) ||
    JSON.stringify(box1.body.playerStats) !== JSON.stringify(box3.body.playerStats);
  ok('a different seed produces a different result', different, { seed1: box1.body.finalScore, seed3: box3.body.finalScore });

  // -------------------------------------------------------------------
  section('Story 3 — box score content + persistence/no-re-simulate');
  // -------------------------------------------------------------------
  ok('final score has team names and point totals with unambiguous winner/tie',
    box1.status === 200 && !!box1.body.teams?.home?.teamName && !!box1.body.teams?.away?.teamName &&
      typeof box1.body.finalScore.home === 'number' && typeof box1.body.finalScore.away === 'number',
    box1.body);

  const qSum = box1.body.quarterByQuarter.reduce((acc, q) => ({ home: acc.home + q.home, away: acc.away + q.away }), { home: 0, away: 0 });
  ok('quarter-by-quarter line sums to final score', qSum.home === box1.body.finalScore.home && qSum.away === box1.body.finalScore.away,
    { qSum, finalScore: box1.body.finalScore });

  const ts = box1.body.teamStats;
  ok('team stat line includes total/passing/rushing yards + turnovers for both teams',
    ['home', 'away'].every((side) => typeof ts[side].totalYards === 'number' && typeof ts[side].passingYards === 'number' && typeof ts[side].rushingYards === 'number' && typeof ts[side].turnovers === 'number'),
    ts);

  const anyPlayerStats = box1.body.playerStats.home.length > 0 || box1.body.playerStats.away.length > 0;
  ok('per-player stat line present for players with activity', anyPlayerStats, box1.body.playerStats);
  const allPlayersHaveSomeActivity = [...box1.body.playerStats.home, ...box1.body.playerStats.away].every((p) => {
    const numericKeys = Object.keys(p).filter((k) => !['playerId', 'firstName', 'lastName', 'position'].includes(k));
    return numericKeys.some((k) => (p[k] ?? 0) !== 0);
  });
  ok('every listed player has at least one non-zero relevant stat (no zero-activity noise rows)', allPlayersHaveSomeActivity,
    [...box1.body.playerStats.home, ...box1.body.playerStats.away].filter((p) => {
      const numericKeys = Object.keys(p).filter((k) => !['playerId', 'firstName', 'lastName', 'position'].includes(k));
      return !numericKeys.some((k) => (p[k] ?? 0) !== 0);
    }));

  // Reload without re-simulating: fetch box score twice more, byte-compare, and confirm no new Game row appears.
  const gamesCountQuery = async () => {
    // No GET /games list route exists; use box-score reload byte-stability + a controlled
    // reload comparison as the practical verification (see report for the "count Game rows"
    // caveat — no list endpoint to directly assert row count without DB access).
    return null;
  };
  const boxReloadA = await api('GET', `/leagues/${LEAGUE_A}/games/${gameId1}/box-score`, { user: USER_A });
  const boxReloadB = await api('GET', `/leagues/${LEAGUE_A}/games/${gameId1}/box-score`, { user: USER_A });
  ok('reloading the box score route returns byte-identical JSON both times (no re-simulation drift)',
    JSON.stringify(boxReloadA.body) === JSON.stringify(boxReloadB.body), { a: boxReloadA.body, b: boxReloadB.body });
  ok('reloaded box score matches the originally-returned result exactly', JSON.stringify(boxReloadA.body) === JSON.stringify(box1.body));

  // Byte-stability above only holds if the DB rows come back in a defined order. Without an
  // explicit ORDER BY, Postgres row order follows the query plan, which changes as the table
  // grows — two reads of the same finished game then differ, looking like re-simulation drift.
  // Assert the ordering contract directly rather than relying on the plan staying put.
  const isSortedByPlayerId = (stats) =>
    stats.every((s, i) => i === 0 || stats[i - 1].playerId <= s.playerId);
  ok('box score home playerStats are ordered by playerId (deterministic serialization)',
    isSortedByPlayerId(boxReloadA.body.playerStats.home), boxReloadA.body.playerStats.home.map((s) => s.playerId));
  ok('box score away playerStats are ordered by playerId (deterministic serialization)',
    isSortedByPlayerId(boxReloadA.body.playerStats.away), boxReloadA.body.playerStats.away.map((s) => s.playerId));

  const missingGame = await api('GET', `/leagues/${LEAGUE_A}/games/does-not-exist/box-score`, { user: USER_A });
  ok('box score for nonexistent game returns 404', missingGame.status === 404, missingGame.body);

  const boxAsB = await api('GET', `/leagues/${LEAGUE_A}/games/${gameId1}/box-score`, { user: USER_B });
  ok('user B cannot read user A\'s box score (404)', boxAsB.status === 404, boxAsB.body);

  // -------------------------------------------------------------------
  section('Contract check — DepthChartResponseDto legality signal');
  // -------------------------------------------------------------------
  const dcLegal = await api('GET', `/depth-charts/${teamA.id}`, { user: USER_A });
  ok(
    'depth chart for a fully-staffed team reports legal: true',
    dcLegal.body?.legal === true,
    dcLegal.body,
  );
  ok(
    'legal: true agrees with an empty warnings array',
    dcLegal.body?.legal === true && dcLegal.body?.warnings?.length === 0,
    dcLegal.body,
  );

  const dcIllegal = await api('GET', `/depth-charts/${unfillableTeamId}`, { user: USER_A });
  ok(
    'depth chart for a team with unfilled required positions reports legal: false',
    dcIllegal.body?.legal === false,
    dcIllegal.body,
  );
  ok(
    'legal: false is accompanied by at least one naming warning',
    dcIllegal.body?.legal === false && dcIllegal.body?.warnings?.length > 0,
    dcIllegal.body,
  );

  // Same class of bug as the box score: unordered entry reads serialize differently
  // depending on the query plan. `position` is a Postgres enum, so ORDER BY sorts by enum
  // declaration order (QB, RB, FB, WR, ...), not alphabetically — assert the properties that
  // ordering guarantees rather than hardcoding the enum's order here.
  const dcRefetch = await api('GET', `/depth-charts/${teamA.id}`, { user: USER_A });
  ok('depth chart entries serialize identically across reads (deterministic order)',
    JSON.stringify(dcRefetch.body.entries) === JSON.stringify(dcLegal.body.entries));

  const dcEntries = dcLegal.body?.entries ?? [];
  const positionRun = dcEntries.map((e) => e.position);
  const groupedContiguously = positionRun.every(
    (p, i) => i === 0 || p !== positionRun[i - 1] ? positionRun.indexOf(p) === i : true,
  );
  const slotsAscendWithinPosition = dcEntries.every((e, i) => {
    if (i === 0) return true;
    const prev = dcEntries[i - 1];
    return prev.position !== e.position || prev.slot < e.slot;
  });
  ok('depth chart entries group each position contiguously', groupedContiguously,
    dcEntries.map((e) => `${e.position}:${e.slot}`));
  ok('depth chart slots ascend within each position', slotsAscendWithinPosition,
    dcEntries.map((e) => `${e.position}:${e.slot}`));

  // -------------------------------------------------------------------
  console.log(`\n=== SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(` - ${f.desc}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('FATAL ERROR in test runner:', e);
  process.exit(2);
});
