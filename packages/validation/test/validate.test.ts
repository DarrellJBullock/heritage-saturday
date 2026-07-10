import assert from 'node:assert/strict';
import test from 'node:test';
import { validateImportRows } from '../src/index';

test('flags missing required fields as ERROR', () => {
  const rows = validateImportRows([
    {
      sheet: 'players',
      rowIndex: 0,
      raw: {
        player_id: 'p1',
        team_id: 't1',
        first_name: 'Jax',
        last_name: 'Rowan',
        // position missing
        jersey_number: 12,
        overall_rating: 80,
      },
    },
  ]);
  assert.equal(rows[0].status, 'ERROR');
  assert.ok(rows[0].messages.some((m) => m.includes('position')));
});

test('flags out-of-range rating and invalid position', () => {
  const rows = validateImportRows([
    {
      sheet: 'players',
      rowIndex: 0,
      raw: {
        player_id: 'p1',
        team_id: 't1',
        first_name: 'Jax',
        last_name: 'Rowan',
        position: 'ZZ',
        jersey_number: 12,
        overall_rating: 150,
      },
    },
  ]);
  assert.equal(rows[0].status, 'ERROR');
  assert.ok(rows[0].messages.some((m) => m.includes('Invalid position')));
  assert.ok(rows[0].messages.some((m) => m.includes('overall_rating')));
});

test('flags duplicate player_id and duplicate jersey per team', () => {
  const rows = validateImportRows([
    {
      sheet: 'players', rowIndex: 0,
      raw: { player_id: 'p1', team_id: 't1', first_name: 'A', last_name: 'B', position: 'QB', jersey_number: 7, overall_rating: 80 },
    },
    {
      sheet: 'players', rowIndex: 1,
      raw: { player_id: 'p1', team_id: 't1', first_name: 'C', last_name: 'D', position: 'RB', jersey_number: 21, overall_rating: 75 },
    },
    {
      sheet: 'players', rowIndex: 2,
      raw: { player_id: 'p3', team_id: 't1', first_name: 'E', last_name: 'F', position: 'WR', jersey_number: 7, overall_rating: 70 },
    },
  ]);

  assert.equal(rows[0].status, 'ERROR'); // dup player_id + dup jersey
  assert.equal(rows[1].status, 'ERROR'); // dup player_id
  assert.equal(rows[2].status, 'ERROR'); // dup jersey
});

test('valid row with no messages is OK', () => {
  const rows = validateImportRows([
    {
      sheet: 'players', rowIndex: 0,
      raw: { player_id: 'p1', team_id: 't1', first_name: 'A', last_name: 'B', position: 'QB', jersey_number: 7, overall_rating: 80 },
    },
    {
      sheet: 'teams', rowIndex: 0,
      raw: { team_id: 't1', team_name: 'Cobalt Crest Coyotes' },
    },
  ]);
  assert.equal(rows[0].status, 'OK');
  assert.equal(rows[1].status, 'OK');
});

test('non-blocking sheets are always forced to OK', () => {
  const rows = validateImportRows([
    { sheet: 'bands', rowIndex: 0, raw: {} },
    { sheet: 'headshots', rowIndex: 0, raw: { totally: 'malformed' } },
  ]);
  assert.equal(rows[0].status, 'OK');
  assert.equal(rows[1].status, 'OK');
});

// --- Orphan player rule: the only WARNING-producing rule in Capability 1 ---

const validPlayer = (teamId: string) => ({
  player_id: 'p1', team_id: teamId, first_name: 'A', last_name: 'B',
  position: 'QB', jersey_number: 7, overall_rating: 80,
});

test('AC10: player referencing a team_id absent from the import is WARNING', () => {
  const rows = validateImportRows([
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t-missing') },
    { sheet: 'teams', rowIndex: 0, raw: { team_id: 't1', team_name: 'Coyotes' } },
  ]);
  assert.equal(rows[0].status, 'WARNING');
  assert.match(rows[0].messages[0], /does not match any team in this import/);
  assert.match(rows[0].messages[0], /will not be created/);
  assert.equal(rows[1].status, 'OK');
});

test('AC11: a blank team_id stays ERROR, never WARNING', () => {
  const rows = validateImportRows([
    { sheet: 'players', rowIndex: 0, raw: { ...validPlayer(''), team_id: '' } },
  ]);
  assert.equal(rows[0].status, 'ERROR');
  assert.ok(rows[0].messages.some((m) => /Missing required field: team_id/.test(m)));
});

test('AC13: player referencing a team whose own row is ERROR is WARNING', () => {
  const rows = validateImportRows([
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t1') },
    // team_name missing => teams row is ERROR => team never committed => player orphaned
    { sheet: 'teams', rowIndex: 0, raw: { team_id: 't1' } },
  ]);
  assert.equal(rows[1].status, 'ERROR');
  assert.equal(rows[0].status, 'WARNING');
});

test('AC13: player referencing a duplicate-team_id team is WARNING (dup marks team ERROR)', () => {
  const rows = validateImportRows([
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t1') },
    { sheet: 'teams', rowIndex: 0, raw: { team_id: 't1', team_name: 'Coyotes' } },
    { sheet: 'teams', rowIndex: 1, raw: { team_id: 't1', team_name: 'Coyotes Again' } },
  ]);
  assert.equal(rows[1].status, 'ERROR');
  assert.equal(rows[2].status, 'ERROR');
  assert.equal(rows[0].status, 'WARNING');
});

test('ERROR outranks WARNING on the same row', () => {
  const rows = validateImportRows([
    // orphan team_id AND an invalid position => ERROR wins
    { sheet: 'players', rowIndex: 0, raw: { ...validPlayer('t-missing'), position: 'ZZ' } },
  ]);
  assert.equal(rows[0].status, 'ERROR');
});

test('AC14: an import with no orphans produces no WARNING rows', () => {
  const rows = validateImportRows([
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t1') },
    { sheet: 'teams', rowIndex: 0, raw: { team_id: 't1', team_name: 'Coyotes' } },
  ]);
  assert.ok(rows.every((r) => r.status !== 'WARNING'));
});

// --- Orphan coaches and depthchart rows ---

const validTeam = { team_id: 't1', team_name: 'Coyotes' };

test('orphan coach (team_id absent from import) is WARNING', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    {
      sheet: 'coaches', rowIndex: 0,
      raw: { coach_id: 'c1', team_id: 't-missing', first_name: 'A', last_name: 'B' },
    },
  ]);
  assert.equal(rows[1].status, 'WARNING');
  assert.match(rows[1].messages[0], /this coach will not be created/);
});

test('coach with a blank team_id stays ERROR, never WARNING', () => {
  const rows = validateImportRows([
    { sheet: 'coaches', rowIndex: 0, raw: { coach_id: 'c1', team_id: '', first_name: 'A', last_name: 'B' } },
  ]);
  assert.equal(rows[0].status, 'ERROR');
});

test('coach linked to a committable team is OK', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    { sheet: 'coaches', rowIndex: 0, raw: { coach_id: 'c1', team_id: 't1', first_name: 'A', last_name: 'B' } },
  ]);
  assert.equal(rows[1].status, 'OK');
});

test('depthchart row referencing an absent team is WARNING naming the team', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t1') },
    { sheet: 'depthchart', rowIndex: 0, raw: { team_id: 't-missing', player_id: 'p1', position: 'QB', slot: 0 } },
  ]);
  assert.equal(rows[2].status, 'WARNING');
  assert.match(rows[2].messages[0], /does not match any team in this import/);
});

test('depthchart row referencing an unknown player is WARNING naming the player', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t1') },
    { sheet: 'depthchart', rowIndex: 0, raw: { team_id: 't1', player_id: 'p-missing', position: 'QB', slot: 0 } },
  ]);
  assert.equal(rows[2].status, 'WARNING');
  assert.match(rows[2].messages[0], /player_id "p-missing"/);
  assert.match(rows[2].messages[0], /will be dropped/);
});

test('depthchart row pointing at an ORPHANED player is itself WARNING (chained orphan)', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    // player references a team that does not exist => player is WARNING, never created
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t-missing') },
    // depthchart row's team IS valid, but its player will not be created
    { sheet: 'depthchart', rowIndex: 0, raw: { team_id: 't1', player_id: 'p1', position: 'QB', slot: 0 } },
  ]);
  assert.equal(rows[1].status, 'WARNING'); // orphan player
  assert.equal(rows[2].status, 'WARNING'); // depends on that player
  assert.match(rows[2].messages[0], /player_id "p1"/);
});

test('depthchart row pointing at an ERROR player is WARNING (player never created)', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    { sheet: 'players', rowIndex: 0, raw: { ...validPlayer('t1'), position: 'ZZ' } }, // ERROR
    { sheet: 'depthchart', rowIndex: 0, raw: { team_id: 't1', player_id: 'p1', position: 'QB', slot: 0 } },
  ]);
  assert.equal(rows[1].status, 'ERROR');
  assert.equal(rows[2].status, 'WARNING');
});

test('a fully-linked depthchart row is OK', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    { sheet: 'players', rowIndex: 0, raw: validPlayer('t1') },
    { sheet: 'depthchart', rowIndex: 0, raw: { team_id: 't1', player_id: 'p1', position: 'QB', slot: 0 } },
  ]);
  assert.ok(rows.every((r) => r.status === 'OK'));
});

test('depthchart orphaned by BOTH team and player names the team (root cause) once', () => {
  const rows = validateImportRows([
    { sheet: 'teams', rowIndex: 0, raw: validTeam },
    { sheet: 'depthchart', rowIndex: 0, raw: { team_id: 't-missing', player_id: 'p-missing', position: 'QB', slot: 0 } },
  ]);
  assert.equal(rows[1].status, 'WARNING');
  assert.equal(rows[1].messages.length, 1);
  assert.match(rows[1].messages[0], /team_id "t-missing"/);
});
