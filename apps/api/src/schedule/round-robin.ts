export interface Matchup {
  week: number; // 1-based
  homeId: string;
  awayId: string;
}

const BYE = '__BYE__';

/**
 * Single round-robin via the circle method: every team plays every other exactly once.
 *
 * For N teams there are N−1 weeks and ⌊N/2⌋ games per week (N odd adds a bye each week, so one
 * team sits out). Deterministic — the matchup set is fully determined by the input order, which
 * callers already fix. Home/away alternates by round so a team is not always home.
 */
export function roundRobin(teamIds: string[]): Matchup[] {
  if (teamIds.length < 2) return [];

  const teams = [...teamIds];
  if (teams.length % 2 === 1) teams.push(BYE);

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const arr = [...teams];
  const matchups: Matchup[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      // Alternate home/away by round and pairing so home games are spread out.
      const swap = (r + i) % 2 === 1;
      matchups.push({ week: r + 1, homeId: swap ? b : a, awayId: swap ? a : b });
    }
    // Rotate: element 0 stays fixed, the rest rotate one step.
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string);
    arr.splice(1, arr.length - 1, ...rest);
  }

  return matchups;
}

/**
 * Reorder a round-robin's WEEKS so rival-heavy weeks fall late in the season, favouring
 * late-season rivalry games (the vision's scheduling rule) without breaking the round-robin —
 * each week is already a valid set, so permuting whole weeks preserves validity. Deterministic:
 * weeks are sorted ascending by rival-game count, ties broken by original week number, then
 * renumbered 1..N. `rivalOf` maps a team id to its rival's id.
 */
export function placeRivalWeeks(matchups: Matchup[], rivalOf: Map<string, string>): Matchup[] {
  const isRival = (m: Matchup) => rivalOf.get(m.homeId) === m.awayId;

  const weeks = new Map<number, Matchup[]>();
  for (const m of matchups) {
    (weeks.get(m.week) ?? weeks.set(m.week, []).get(m.week)!).push(m);
  }

  const ordered = [...weeks.entries()]
    .map(([week, games]) => ({ week, games, rivals: games.filter(isRival).length }))
    .sort((a, b) => a.rivals - b.rivals || a.week - b.week);

  const result: Matchup[] = [];
  ordered.forEach((entry, idx) => {
    const newWeek = idx + 1;
    for (const g of entry.games) result.push({ ...g, week: newWeek });
  });
  return result;
}
