import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roundRobin, placeRivalWeeks } from '../src/schedule/round-robin';

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

describe('roundRobin', () => {
  for (const n of [2, 4, 8, 16, 24]) {
    const teams = Array.from({ length: n }, (_, i) => `t${i}`);
    const matchups = roundRobin(teams);

    it(`N=${n}: every unordered pair appears exactly once`, () => {
      const seen = new Map<string, number>();
      for (const m of matchups) {
        const k = pairKey(m.homeId, m.awayId);
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      const expectedPairs = (n * (n - 1)) / 2;
      assert.equal(seen.size, expectedPairs, 'distinct pair count');
      assert.equal(matchups.length, expectedPairs, 'total game count');
      for (const [k, count] of seen) assert.equal(count, 1, `pair ${k} played ${count}x`);
    });

    it(`N=${n}: uses N-1 weeks with N/2 games each`, () => {
      const weeks = new Set(matchups.map((m) => m.week));
      assert.equal(weeks.size, n - 1, 'week count');
      for (let w = 1; w <= n - 1; w++) {
        const inWeek = matchups.filter((m) => m.week === w);
        assert.equal(inWeek.length, n / 2, `games in week ${w}`);
      }
    });

    it(`N=${n}: no team plays twice in the same week`, () => {
      for (let w = 1; w <= n - 1; w++) {
        const inWeek = matchups.filter((m) => m.week === w);
        const teamsThisWeek = inWeek.flatMap((m) => [m.homeId, m.awayId]);
        assert.equal(new Set(teamsThisWeek).size, teamsThisWeek.length, `week ${w} has a repeat`);
      }
    });
  }

  it('odd N gives each team a bye (N-1 games, one team idle per week)', () => {
    const teams = ['a', 'b', 'c', 'd', 'e'];
    const matchups = roundRobin(teams);
    // 5 teams -> C(5,2) = 10 games across 5 weeks (N-1 for the padded even count), 2 games/week.
    assert.equal(matchups.length, 10);
    assert.equal(new Set(matchups.map((m) => m.week)).size, 5);
    assert.ok(!matchups.some((m) => m.homeId === '__BYE__' || m.awayId === '__BYE__'));
  });

  it('is deterministic', () => {
    const teams = ['a', 'b', 'c', 'd'];
    assert.deepEqual(roundRobin(teams), roundRobin(teams));
  });

  it('fewer than two teams yields no games', () => {
    assert.deepEqual(roundRobin([]), []);
    assert.deepEqual(roundRobin(['solo']), []);
  });
});

describe('placeRivalWeeks', () => {
  // Pair up adjacent teams as rivals: t0<->t1, t2<->t3, ... (symmetric).
  const rivalMap = (n: number) => {
    const m = new Map<string, string>();
    for (let i = 0; i < n; i += 2) {
      m.set(`t${i}`, `t${i + 1}`);
      m.set(`t${i + 1}`, `t${i}`);
    }
    return m;
  };
  const isRival = (m: Map<string, string>, g: { homeId: string; awayId: string }) =>
    m.get(g.homeId) === g.awayId;

  for (const n of [4, 8, 16]) {
    const teams = Array.from({ length: n }, (_, i) => `t${i}`);
    const rivals = rivalMap(n);
    const placed = placeRivalWeeks(roundRobin(teams), rivals);
    const totalWeeks = n - 1;

    it(`N=${n}: preserves every game and keeps each week a valid set`, () => {
      assert.equal(placed.length, (n * (n - 1)) / 2, 'game count unchanged');
      const weeks = new Set(placed.map((m) => m.week));
      assert.equal(weeks.size, totalWeeks, 'week count unchanged');
      for (let w = 1; w <= totalWeeks; w++) {
        const inWeek = placed.filter((m) => m.week === w);
        const seen = inWeek.flatMap((m) => [m.homeId, m.awayId]);
        assert.equal(new Set(seen).size, seen.length, `week ${w} has a repeat team`);
      }
    });

    it(`N=${n}: rival games land in the later half of the season`, () => {
      const rivalWeeks = placed.filter((m) => isRival(rivals, m)).map((m) => m.week);
      assert.ok(rivalWeeks.length > 0, 'there are rival games');
      const half = totalWeeks / 2;
      for (const w of rivalWeeks) {
        assert.ok(w > half, `rival game in week ${w} is not in the later half (>${half})`);
      }
    });
  }

  it('is deterministic', () => {
    const teams = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const rivals = rivalMap(8);
    assert.deepEqual(
      placeRivalWeeks(roundRobin(teams), rivals),
      placeRivalWeeks(roundRobin(teams), rivals),
    );
  });

  it('an empty rival map leaves the schedule unchanged', () => {
    const teams = Array.from({ length: 6 }, (_, i) => `t${i}`);
    const original = roundRobin(teams);
    assert.deepEqual(placeRivalWeeks(original, new Map()), original);
  });
});
