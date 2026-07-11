import { Rng, rngInt } from '@heritage-saturday/shared';

// Play-by-play WITHOUT changing the game's outcome. The drive engine still computes every drive's
// total yards and outcome from the main RNG stream exactly as before; this decomposes an
// already-computed drive into a plausible sequence of plays using a SEPARATE, per-drive RNG (so
// the main stream — and therefore every score and stat — is untouched and stays reproducible).
//
// Invariant: the plays' yards sum to the drive's yards, and the sequence ends in the drive's
// outcome. Field position and clock are synthesized for presentation, not physically exact.

export interface SimPlay {
  down: number; // situation at the snap
  yardsToGo: number;
  yardLine: number; // 1-99, yards from the offense's own goal line (100 = TD)
  clock: string; // MM:SS remaining in the quarter, at the snap
  playType: 'RUN' | 'PASS' | 'FIELD_GOAL' | 'PUNT';
  yards: number;
  result:
    | 'GAIN'
    | 'NO_GAIN'
    | 'FIRST_DOWN'
    | 'TOUCHDOWN'
    | 'FIELD_GOAL_GOOD'
    | 'FIELD_GOAL_MISS'
    | 'PUNT'
    | 'INTERCEPTION'
    | 'FUMBLE';
  description: string;
}

export interface DriveForPlays {
  outcome: 'TD' | 'FG' | 'PUNT' | 'TURNOVER' | 'MISSED_FG';
  yards: number;
  passYards: number;
  rushYards: number;
  possessionSeconds: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Break a yard total into positive chunks that sum to it EXACTLY (last chunk absorbs remainder). */
function splitYards(rng: Rng, total: number, per: number): number[] {
  if (total <= 0) return [];
  const n = clamp(Math.round(total / per), 1, 8);
  const chunks: number[] = [];
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      chunks.push(total - assigned); // remainder — keeps the sum exact
    } else {
      const base = Math.round(total / n);
      const v = clamp(base + rngInt(rng, -3, 4), 0, total - assigned);
      chunks.push(v);
      assigned += v;
    }
  }
  return chunks;
}

function describe(type: SimPlay['playType'], yards: number, result: string): string {
  if (result === 'TOUCHDOWN') return type === 'PASS' ? `Touchdown pass, ${yards} yards` : `${yards}-yard rushing touchdown`;
  if (result === 'FIELD_GOAL_GOOD') return 'Field goal is good';
  if (result === 'FIELD_GOAL_MISS') return 'Field goal is no good';
  if (result === 'PUNT') return 'Punt';
  if (result === 'INTERCEPTION') return 'Pass intercepted';
  if (result === 'FUMBLE') return 'Fumble, recovered by the defense';
  const verb = type === 'PASS' ? 'Pass complete for' : 'Rush for';
  const suffix = result === 'FIRST_DOWN' ? ' (first down)' : '';
  return `${verb} ${yards} yard${yards === 1 ? '' : 's'}${suffix}`;
}

/**
 * Decompose one drive into plays. `rng` is a per-drive stream, independent of the main engine
 * RNG. `clockStart` is the seconds remaining in the quarter at the start of the drive.
 */
export function decomposeDrive(rng: Rng, drive: DriveForPlays, clockStart: number): SimPlay[] {
  const passChunks = splitYards(rng, drive.passYards, 9).map((y) => ({ t: 'PASS' as const, y }));
  const runChunks = splitYards(rng, drive.rushYards, 5).map((y) => ({ t: 'RUN' as const, y }));

  const moving: { t: 'PASS' | 'RUN'; y: number }[] = [];
  let pi = 0;
  let ri = 0;
  while (pi < passChunks.length || ri < runChunks.length) {
    const takePass = ri >= runChunks.length || (pi < passChunks.length && rng() < 0.5);
    moving.push(takePass ? passChunks[pi++] : runChunks[ri++]);
  }
  if (moving.length === 0) moving.push({ t: 'RUN', y: Math.max(0, drive.yards) });

  const plays: SimPlay[] = [];
  let down = 1;
  let toGo = 10;
  let ball = rngInt(rng, 20, 35); // synthesized starting field position (~own 25)
  let clock = clockStart;
  const timePer = Math.max(12, Math.floor(drive.possessionSeconds / (moving.length + 1)));

  moving.forEach((m, i) => {
    const isTdPlay = drive.outcome === 'TD' && i === moving.length - 1;
    const snapshot = { down, yardsToGo: toGo, yardLine: ball, clock: fmtClock(clock) };
    clock = Math.max(0, clock - timePer);

    let result: SimPlay['result'];
    if (isTdPlay) {
      ball = 100;
      result = 'TOUCHDOWN';
    } else {
      ball = clamp(ball + m.y, 1, 99);
      toGo -= m.y;
      if (toGo <= 0) {
        result = 'FIRST_DOWN';
        down = 1;
        toGo = 10;
      } else if (down >= 4) {
        // Assume the offense converted rather than turning it over on downs mid-drive.
        result = m.y > 0 ? 'GAIN' : 'NO_GAIN';
        down = 1;
        toGo = 10;
      } else {
        result = m.y > 0 ? 'GAIN' : 'NO_GAIN';
        down += 1;
      }
    }

    plays.push({
      ...snapshot,
      playType: m.t,
      yards: m.y,
      result,
      description: describe(m.t, m.y, result),
    });
  });

  // Terminal special-teams / turnover play (TD already ended on the last moving play above).
  if (drive.outcome !== 'TD') {
    const snapshot = { down, yardsToGo: toGo, yardLine: ball, clock: fmtClock(Math.max(0, clock)) };
    let playType: SimPlay['playType'];
    let result: SimPlay['result'];
    if (drive.outcome === 'FG') {
      playType = 'FIELD_GOAL';
      result = 'FIELD_GOAL_GOOD';
    } else if (drive.outcome === 'MISSED_FG') {
      playType = 'FIELD_GOAL';
      result = 'FIELD_GOAL_MISS';
    } else if (drive.outcome === 'PUNT') {
      playType = 'PUNT';
      result = 'PUNT';
    } else {
      playType = 'PASS';
      result = rng() < 0.6 ? 'INTERCEPTION' : 'FUMBLE';
    }
    plays.push({ ...snapshot, playType, yards: 0, result, description: describe(playType, 0, result) });
  }

  return plays;
}
