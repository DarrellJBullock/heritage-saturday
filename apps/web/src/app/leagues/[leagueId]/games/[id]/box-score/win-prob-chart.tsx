import type { WinProbabilityPointDto } from '@heritage-saturday/shared';

/**
 * A compact, theme-aware win-probability line for the home team over the game (0.5 = even).
 * Single series, so no legend — the caption names it. Colors are the app's CSS tokens, so it
 * flips with light/dark automatically. It's a labeled summary sparkline (static, no hover): the
 * midline and endpoints carry the reading, and the same information is in the scorebug + recap.
 */
export function WinProbChart({
  points,
  homeName,
  awayName,
}: {
  points: WinProbabilityPointDto[];
  homeName: string;
  awayName: string;
}) {
  const w = 320;
  const h = 96;
  const padX = 8;
  const padY = 12;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const n = points.length;
  const x = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const y = (wp: number) => padY + (1 - wp) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.homeWinProb)}`).join(' ');
  const last = points[n - 1];
  const finalPct = Math.round(last.homeWinProb * 100);

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Win probability over the game">
        {/* 0.5 reference line — above favors home, below favors away */}
        <line
          x1={padX}
          x2={w - padX}
          y1={y(0.5)}
          y2={y(0.5)}
          style={{ stroke: 'var(--border)' }}
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        <path
          d={path}
          fill="none"
          style={{ stroke: 'var(--primary)' }}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(n - 1)} cy={y(last.homeWinProb)} r={3} style={{ fill: 'var(--primary)' }} />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {homeName} above · {awayName} below the line
        </span>
        <span>
          Win probability (estimate) — final {finalPct}% {homeName}
        </span>
      </div>
    </div>
  );
}
