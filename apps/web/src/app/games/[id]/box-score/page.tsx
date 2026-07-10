import { apiClient, ApiError } from '@/lib/api-client';
import type { BoxScoreResponseDto, PlayerGameStatsDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface PageProps {
  params: Promise<{ id: string }>;
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
  const { id } = await params;

  let box: BoxScoreResponseDto | null = null;
  let error: string | null = null;

  try {
    box = await apiClient.get<BoxScoreResponseDto>(`/games/${id}/box-score`);
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
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {winner === 'Tie' ? 'Final: Tie game' : `Winner: ${winner}`} · seed{' '}
            <code>{box.seed}</code>
          </p>
        </CardContent>
      </Card>

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
                      {p.firstName} {p.lastName}
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
