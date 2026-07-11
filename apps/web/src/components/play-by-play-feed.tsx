// The play-by-play feed — a Server-renderable list built from GET /games/:id/plays. Plays are
// grouped into drives (consecutive plays by the same team), with a quarter heading when it turns
// over. No client interactivity needed; the feed is static once the game is final.

import { Badge } from '@/components/ui/badge';
import type { PlayByPlayResponseDto, PlayDto } from '@heritage-saturday/shared';

const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

function downDistance(p: PlayDto): string {
  if (!p.down || p.playType === 'PUNT' || p.playType === 'FIELD_GOAL') return '';
  return `${ORDINAL[p.down] ?? `${p.down}th`} & ${p.yardsToGo}`;
}

type Variant = 'default' | 'secondary' | 'destructive' | 'outline';

function chip(p: PlayDto): { label: string; variant: Variant } {
  switch (p.result) {
    case 'TOUCHDOWN':
      return { label: 'TD', variant: 'default' };
    case 'FIELD_GOAL_GOOD':
      return { label: 'FG', variant: 'default' };
    case 'FIELD_GOAL_MISS':
      return { label: 'No good', variant: 'secondary' };
    case 'PUNT':
      return { label: 'Punt', variant: 'secondary' };
    case 'INTERCEPTION':
      return { label: 'INT', variant: 'destructive' };
    case 'FUMBLE':
      return { label: 'Fumble', variant: 'destructive' };
    default:
      return { label: p.yards >= 0 ? `+${p.yards}` : `${p.yards}`, variant: 'outline' };
  }
}

interface DriveGroup {
  quarter: number;
  teamId: string | null;
  teamName: string;
  plays: PlayDto[];
}

export function PlayByPlayFeed({ pbp }: { pbp: PlayByPlayResponseDto }) {
  const teamName = (side: 'home' | 'away') =>
    side === 'home' ? pbp.teams.home.teamName : pbp.teams.away.teamName;

  const groups: DriveGroup[] = [];
  for (const p of pbp.plays) {
    const last = groups[groups.length - 1];
    if (!last || last.teamId !== p.teamId || last.quarter !== p.quarter) {
      groups.push({ quarter: p.quarter, teamId: p.teamId, teamName: teamName(p.side), plays: [p] });
    } else {
      last.plays.push(p);
    }
  }

  const quarterLabel = (q: number) => (q <= 4 ? `Quarter ${q}` : 'Overtime');

  return (
    <div className="max-h-[34rem] overflow-y-auto pr-1">
      <div className="flex flex-col gap-3">
        {groups.map((g, gi) => (
          <div key={gi}>
            {(gi === 0 || groups[gi - 1].quarter !== g.quarter) && (
              <p className="text-muted-foreground mb-1 mt-2 text-xs font-medium uppercase tracking-wide">
                {quarterLabel(g.quarter)}
              </p>
            )}
            <div className="border-brand/40 rounded-md border-l-2 pl-3">
              <p className="text-sm font-semibold">{g.teamName}</p>
              <div className="mt-1 flex flex-col">
                {g.plays.map((p, pi) => {
                  const c = chip(p);
                  const dd = downDistance(p);
                  return (
                    <div
                      key={pi}
                      className="flex items-center gap-2 border-b py-1 text-sm last:border-b-0"
                    >
                      <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">
                        {dd || '—'}
                        {p.clock ? ` · ${p.clock}` : ''}
                      </span>
                      <span className="flex-1">{p.description}</span>
                      <Badge variant={c.variant} className="shrink-0">
                        {c.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
