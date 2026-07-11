import type { PlayDto } from '@heritage-saturday/shared';

// Template-driven text commentary — original phrasing, no real-broadcast wording. Deterministic:
// the same play at the same index always produces the same line (variety comes from the index,
// not randomness), so a replay reads identically each time.

export interface CommentaryContext {
  homeName: string;
  awayName: string;
  homeScore: number; // running score AFTER this play
  awayScore: number;
}

function pick(options: string[], seed: number): string {
  return options[Math.abs(seed) % options.length];
}

function scoreTag(ctx: CommentaryContext, scoringSide: 'home' | 'away'): string {
  const { homeScore: h, awayScore: a, homeName, awayName } = ctx;
  if (h === a) return ` We're all square at ${h}.`;
  const leader = h > a ? homeName : awayName;
  const margin = Math.abs(h - a);
  const justTook = scoringSide === (h > a ? 'home' : 'away');
  if (justTook && margin <= 8) return ` ${leader} take the lead, ${Math.max(h, a)}–${Math.min(h, a)}.`;
  return ` ${leader} out in front, ${Math.max(h, a)}–${Math.min(h, a)}.`;
}

/** One narration line for a play. `index` drives deterministic variety. */
export function commentaryFor(play: PlayDto, ctx: CommentaryContext, index: number): string {
  const off = play.side === 'home' ? ctx.homeName : ctx.awayName;
  const def = play.side === 'home' ? ctx.awayName : ctx.homeName;
  const y = play.yards;

  switch (play.result) {
    case 'TOUCHDOWN':
      return (
        pick(
          [
            `Touchdown, ${off}! ${play.playType === 'PASS' ? 'Threading it into the end zone' : 'Powering across the goal line'} from ${y} out.`,
            `${off} find the end zone! A ${y}-yard ${play.playType === 'PASS' ? 'strike' : 'run'} caps the drive.`,
            `They punch it in — touchdown ${off}!`,
          ],
          index,
        ) + scoreTag(ctx, play.side)
      );
    case 'FIELD_GOAL_GOOD':
      return (
        pick(
          [`The kick is up… and it's good! Three for ${off}.`, `${off} split the uprights — field goal is good.`],
          index,
        ) + scoreTag(ctx, play.side)
      );
    case 'FIELD_GOAL_MISS':
      return pick([`The kick sails wide — no good.`, `And it's no good! ${off} come away empty.`], index);
    case 'PUNT':
      return pick([`${off} bring out the punt team.`, `Fourth down — ${off} will punt it away.`], index);
    case 'INTERCEPTION':
      return pick([`Intercepted! ${def} take it away.`, `Picked off — a huge takeaway for ${def}.`], index);
    case 'FUMBLE':
      return pick([`Fumble! And ${def} pounce on it.`, `The ball is loose — recovered by ${def}!`], index);
    case 'FIRST_DOWN':
      return pick(
        [
          `${y} yards and a fresh set of downs for ${off}.`,
          `${off} move the chains — ${y} on the ${play.playType === 'PASS' ? 'completion' : 'carry'}.`,
        ],
        index,
      );
    case 'NO_GAIN':
      return pick([`Stuffed at the line — no gain.`, `${def} hold firm. Nothing doing there.`], index);
    default:
      if (y >= 20) return pick([`Huge play! ${y} yards for ${off}.`, `${off} break one loose — ${y} yards!`], index);
      if (play.playType === 'PASS') return pick([`${off} complete it for ${y}.`, `Caught for a gain of ${y}.`], index);
      return pick([`${off} on the ground for ${y}.`, `A ${y}-yard carry for ${off}.`], index);
  }
}
