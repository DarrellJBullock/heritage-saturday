import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGame } from '../src/engine';
import { SimulationInput, SimInputTeam } from '../src/types';

function makeTeam(teamId: string): SimInputTeam {
  const players = [
    { id: `${teamId}-qb1`, position: 'QB' as const, overallRating: 82, throwPower: 80, throwAccuracy: 78 },
    { id: `${teamId}-rb1`, position: 'RB' as const, overallRating: 78, carry: 75, trucking: 70 },
    { id: `${teamId}-wr1`, position: 'WR' as const, overallRating: 80, catching: 80, routeRunning: 77 },
    { id: `${teamId}-wr2`, position: 'WR' as const, overallRating: 75, catching: 74, routeRunning: 73 },
    { id: `${teamId}-te1`, position: 'TE' as const, overallRating: 70 },
    { id: `${teamId}-lt1`, position: 'LT' as const, overallRating: 76 },
    { id: `${teamId}-lg1`, position: 'LG' as const, overallRating: 74 },
    { id: `${teamId}-c1`, position: 'C' as const, overallRating: 73 },
    { id: `${teamId}-rg1`, position: 'RG' as const, overallRating: 74 },
    { id: `${teamId}-rt1`, position: 'RT' as const, overallRating: 75 },
    { id: `${teamId}-le1`, position: 'LE' as const, overallRating: 77 },
    { id: `${teamId}-re1`, position: 'RE' as const, overallRating: 76 },
    { id: `${teamId}-dt1`, position: 'DT' as const, overallRating: 75 },
    { id: `${teamId}-lolb1`, position: 'LOLB' as const, overallRating: 74 },
    { id: `${teamId}-mlb1`, position: 'MLB' as const, overallRating: 79, tackle: 80 },
    { id: `${teamId}-rolb1`, position: 'ROLB' as const, overallRating: 74 },
    { id: `${teamId}-cb1`, position: 'CB' as const, overallRating: 76, coverage: 78 },
    { id: `${teamId}-fs1`, position: 'FS' as const, overallRating: 75, coverage: 76 },
    { id: `${teamId}-ss1`, position: 'SS' as const, overallRating: 74, coverage: 74 },
    { id: `${teamId}-k1`, position: 'K' as const, overallRating: 72, kickPower: 80, kickAccuracy: 82 },
    { id: `${teamId}-p1`, position: 'P' as const, overallRating: 70 },
  ];

  const depthChart = players.map((p) => ({ position: p.position, slot: 0, playerId: p.id }));

  return {
    teamId,
    offArchetype: 'BALANCED',
    defArchetype: 'BALANCED_4_3',
    players,
    depthChart,
  };
}

function buildInput(seed: string): SimulationInput {
  return {
    home: makeTeam('home-team'),
    away: makeTeam('away-team'),
    seed,
  };
}

test('same seed produces byte-identical results', () => {
  const resultA = simulateGame(buildInput('season-week-1'));
  const resultB = simulateGame(buildInput('season-week-1'));
  assert.deepEqual(resultA, resultB);
});

test('different seeds produce different results', () => {
  const resultA = simulateGame(buildInput('seed-alpha'));
  const resultB = simulateGame(buildInput('seed-beta'));
  assert.notDeepEqual(resultA, resultB);
});

/** Sum a stat across one team's player rows. Absent stats count as zero. */
function totalFor(
  result: ReturnType<typeof simulateGame>,
  teamId: string,
  key: 'passCompletions' | 'passYards' | 'passTDs' | 'receptions' | 'receivingYards' | 'receivingTDs' | 'rushYards' | 'targets' | 'passAttempts',
): number {
  return result.playerStats
    .filter((p) => p.teamId === teamId)
    .reduce((sum, p) => sum + (p[key] ?? 0), 0);
}

const SEEDS = ['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5', 'inv-6', 'inv-7', 'inv-8'];

/**
 * Stat-coherence invariants. Each of these failed before receptions were attributed
 * on every drive rather than only on passing touchdowns — the old engine made
 * `receptions === receivingTDs` an identity and dropped the yardage from every
 * non-scoring drive. Run across several seeds so no single game's luck hides a gap.
 */
test('every completion is caught by someone', () => {
  for (const seed of SEEDS) {
    const result = simulateGame(buildInput(seed));
    for (const teamId of ['home-team', 'away-team']) {
      assert.equal(
        totalFor(result, teamId, 'receptions'),
        totalFor(result, teamId, 'passCompletions'),
        `${seed}/${teamId}: receptions must equal completions`,
      );
    }
  }
});

test('receiving yards reconcile with passing yards and the team total', () => {
  for (const seed of SEEDS) {
    const result = simulateGame(buildInput(seed));
    for (const side of ['home', 'away'] as const) {
      const teamId = `${side}-team`;
      const passYards = totalFor(result, teamId, 'passYards');
      assert.equal(
        totalFor(result, teamId, 'receivingYards'),
        passYards,
        `${seed}/${teamId}: receiving yards must equal passing yards`,
      );
      assert.equal(
        passYards,
        result.teamStats[side].passingYards,
        `${seed}/${teamId}: player passing yards must equal team passing yards`,
      );
    }
  }
});

test('rushing yards reconcile with the team total', () => {
  for (const seed of SEEDS) {
    const result = simulateGame(buildInput(seed));
    for (const side of ['home', 'away'] as const) {
      assert.equal(
        totalFor(result, `${side}-team`, 'rushYards'),
        result.teamStats[side].rushingYards,
        `${seed}/${side}: player rushing yards must equal team rushing yards`,
      );
    }
  }
});

test('every passing touchdown is caught for a receiving touchdown', () => {
  for (const seed of SEEDS) {
    const result = simulateGame(buildInput(seed));
    for (const teamId of ['home-team', 'away-team']) {
      assert.equal(
        totalFor(result, teamId, 'receivingTDs'),
        totalFor(result, teamId, 'passTDs'),
        `${seed}/${teamId}: receiving TDs must equal passing TDs`,
      );
    }
  }
});

test('not every reception is a touchdown', () => {
  // The precise shape of the original bug: receptions were only ever written in the
  // same statement that wrote a touchdown, so the two were identically equal. Guard
  // against a regression that reintroduces that coupling.
  const totals = SEEDS.map((seed) => {
    const result = simulateGame(buildInput(seed));
    return {
      receptions: totalFor(result, 'home-team', 'receptions') + totalFor(result, 'away-team', 'receptions'),
      tds: totalFor(result, 'home-team', 'receivingTDs') + totalFor(result, 'away-team', 'receivingTDs'),
    };
  });
  const receptions = totals.reduce((s, t) => s + t.receptions, 0);
  const tds = totals.reduce((s, t) => s + t.tds, 0);
  assert.ok(receptions > 0, 'expected some receptions');
  assert.ok(tds < receptions, `expected most catches not to be touchdowns, got ${tds} TDs on ${receptions} catches`);
});

test('per-player totals stay internally consistent', () => {
  for (const seed of SEEDS) {
    const result = simulateGame(buildInput(seed));
    for (const p of result.playerStats) {
      if (p.passAttempts !== undefined) {
        assert.ok(
          (p.passCompletions ?? 0) <= p.passAttempts,
          `${seed}: completions exceed attempts for ${p.playerId}`,
        );
      }
      if (p.receptions !== undefined) {
        assert.ok(
          p.receptions <= (p.targets ?? 0),
          `${seed}: receptions exceed targets for ${p.playerId}`,
        );
        assert.ok(
          (p.receivingTDs ?? 0) <= p.receptions,
          `${seed}: receiving TDs exceed receptions for ${p.playerId}`,
        );
      }
      assert.ok((p.receivingYards ?? 0) >= 0, `${seed}: negative receiving yards for ${p.playerId}`);
    }
  }
});

test('team total yards equal passing plus rushing', () => {
  for (const seed of SEEDS) {
    const result = simulateGame(buildInput(seed));
    for (const side of ['home', 'away'] as const) {
      const t = result.teamStats[side];
      assert.equal(t.totalYards, t.passingYards + t.rushingYards, `${seed}/${side}: total yards must split cleanly`);
    }
  }
});

test('produces a legal final score that matches quarter-by-quarter sum', () => {
  const result = simulateGame(buildInput('legality-check'));
  const summedHome = result.quarterByQuarter.reduce((sum, q) => sum + q.home, 0);
  const summedAway = result.quarterByQuarter.reduce((sum, q) => sum + q.away, 0);
  assert.equal(summedHome, result.finalScore.home);
  assert.equal(summedAway, result.finalScore.away);
  assert.ok(Number.isInteger(result.finalScore.home));
  assert.ok(Number.isInteger(result.finalScore.away));
  assert.ok(result.finalScore.home >= 0);
  assert.ok(result.finalScore.away >= 0);
});
