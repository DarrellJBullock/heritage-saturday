import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { BoxScoreResponseDto, PlayerGameStatsDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { WinProbChart } from './win-prob-chart';

// Accent color per drive outcome for the drive feed.
function outcomeVariant(outcome: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (outcome === 'TD' || outcome === 'FG') return 'default';
  if (outcome === 'TURNOVER') return 'destructive';
  return 'secondary';
}

interface PageProps {
  params: Promise<{ leagueId: string; id: string }>;
}

function playerStatLine(p: PlayerGameStatsDto): string {
  const parts: string[] = [];
  if (p.passAttempts) {
    parts.push(
      `${p.passCompletions ?? 0}/${p.passAttempts} passing, ${p.passYards ?? 0} yds, ${p.passTDs ?? 0} TD, ${p.interceptions ?? 0} INT`,
    );
  }
  if (p.carries) {
    parts.push(`${p.carries} car, ${p.rushYards ?? 0} yds, ${p.rushTDs ?? 0} TD`);
  }
  if (p.receptions || p.targets) {
    parts.push(
      `${p.receptions ?? 0}/${p.targets ?? 0} rec, ${p.receivingYards ?? 0} yds, ${p.receivingTDs ?? 0} TD`,
    );
  }
  if (p.tackles || p.sacks || p.defInterceptions) {
    parts.push(
      `${p.tackles ?? 0} tkl, ${p.sacks ?? 0} sack, ${p.defInterceptions ?? 0} INT`,
    );
  }
  if (p.fgAttempts || p.xpMade) {
    parts.push(`${p.fgMade ?? 0}/${p.fgAttempts ?? 0} FG, ${p.xpMade ?? 0} XP`);
  }
  return parts.join(' · ') || '—';
}

/**
 * Server Component: box score is read-only, plain-text/simple-HTML per spec
 * (no animation/audio/PixiJS in Cap 1) — no client interactivity required, so
 * this fetches directly on the server.
 */
export default async function BoxScorePage({ params }: PageProps) {
  const { leagueId, id } = await params;

  let box: BoxScoreResponseDto | null = null;
  let error: string | null = null;

  try {
    box = await serverApiClient.get<BoxScoreResponseDto>(`/leagues/${leagueId}/games/${id}/box-score`);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load box score.';
  }

  if (error || !box) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load box score</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const winner =
    box.finalScore.home === box.finalScore.away
      ? 'Tie'
      : box.finalScore.home > box.finalScore.away
        ? box.teams.home.teamName
        : box.teams.away.teamName;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {box.teams.home.teamName} {box.finalScore.home} — {box.finalScore.away}{' '}
            {box.teams.away.teamName}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">{box.recap}</p>
          <p className="text-xs text-muted-foreground">
            {winner === 'Tie' ? 'Final: Tie game' : `Winner: ${winner}`} · seed{' '}
            <code>{box.seed}</code>
          </p>
        </CardContent>
      </Card>

      {/* Win probability + top performers side by side on wide screens. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Win Probability</CardTitle>
          </CardHeader>
          <CardContent>
            <WinProbChart
              points={box.winProbability}
              homeName={box.teams.home.teamName}
              awayName={box.teams.away.teamName}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performers</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            {(['home', 'away'] as const).map((side) => (
              <div key={side} className="flex flex-col gap-2">
                <p className="font-medium">{box.teams[side].teamName}</p>
                {box.leaders[side].length === 0 ? (
                  <p className="text-muted-foreground text-xs">—</p>
                ) : (
                  box.leaders[side].map((p) => (
                    <div key={`${p.role}-${p.playerId}`} className="flex flex-col">
                      <Link
                        href={`/leagues/${leagueId}/players/${p.playerId}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {p.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">{p.line}</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Drive by Drive</h2>
        <div className="flex flex-col gap-1">
          {box.drives.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b py-1 text-sm">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground w-8 text-xs">
                  {d.quarter <= 4 ? `Q${d.quarter}` : 'OT'}
                </span>
                {d.teamName}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{d.yards} yds</span>
                <Badge variant={outcomeVariant(d.outcome)}>
                  {d.outcome}
                  {d.points > 0 ? ` +${d.points}` : ''}
                </Badge>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Quarter-by-Quarter</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              {box.quarterByQuarter.map((q) => (
                <TableHead key={q.quarter}>{q.quarter <= 4 ? `Q${q.quarter}` : 'OT'}</TableHead>
              ))}
              <TableHead>Final</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{box.teams.home.teamName}</TableCell>
              {box.quarterByQuarter.map((q) => (
                <TableCell key={q.quarter}>{q.home}</TableCell>
              ))}
              <TableCell className="font-semibold">{box.finalScore.home}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{box.teams.away.teamName}</TableCell>
              {box.quarterByQuarter.map((q) => (
                <TableCell key={q.quarter}>{q.away}</TableCell>
              ))}
              <TableCell className="font-semibold">{box.finalScore.away}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Team Stats</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Total Yds</TableHead>
              <TableHead>Pass Yds</TableHead>
              <TableHead>Rush Yds</TableHead>
              <TableHead>Turnovers</TableHead>
              <TableHead>Time of Possession</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(['home', 'away'] as const).map((side) => (
              <TableRow key={side}>
                <TableCell>{box!.teams[side].teamName}</TableCell>
                <TableCell>{box!.teamStats[side].totalYards}</TableCell>
                <TableCell>{box!.teamStats[side].passingYards}</TableCell>
                <TableCell>{box!.teamStats[side].rushingYards}</TableCell>
                <TableCell>{box!.teamStats[side].turnovers}</TableCell>
                <TableCell>
                  {box!.teamStats[side].timeOfPossessionSeconds != null
                    ? `${Math.floor(box!.teamStats[side].timeOfPossessionSeconds! / 60)}:${String(
                        box!.teamStats[side].timeOfPossessionSeconds! % 60,
                      ).padStart(2, '0')}`
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Separator />

      {(['home', 'away'] as const).map((side) => (
        <div key={side}>
          <h2 className="text-lg font-semibold mb-2">
            {box!.teams[side].teamName} — Player Stats
          </h2>
          {box!.playerStats[side].length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded player activity.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>Line</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {box!.playerStats[side].map((p) => (
                  <TableRow key={p.playerId}>
                    <TableCell>
                      <Link
                        href={`/leagues/${leagueId}/players/${p.playerId}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {p.firstName} {p.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{p.position}</TableCell>
                    <TableCell className="text-sm">{playerStatLine(p)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
    </div>
  );
}
