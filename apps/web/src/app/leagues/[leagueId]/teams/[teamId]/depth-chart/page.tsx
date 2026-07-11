import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { TeamDetailDto, DepthChartResponseDto } from '@heritage-saturday/shared';
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
import { DepthChartEditor } from '@/components/depth-chart-editor';

/** Server Component: a team's depth chart — read-only for members, editable for the owner. */
export default async function DepthChartPage({
  params,
}: {
  params: Promise<{ leagueId: string; teamId: string }>;
}) {
  const { leagueId, teamId } = await params;

  let team: TeamDetailDto | null = null;
  let chart: DepthChartResponseDto | null = null;
  let error: string | null = null;
  try {
    [team, chart] = await Promise.all([
      serverApiClient.get<TeamDetailDto>(`/teams/${teamId}`),
      serverApiClient.get<DepthChartResponseDto>(`/depth-charts/${teamId}`),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load the depth chart.';
  }

  if (error || !team || !chart) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load depth chart</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const nameById = new Map(team.players.map((p) => [p.id, `#${p.jerseyNumber} ${p.firstName} ${p.lastName}`]));

  // Group entries by position for the read-only view.
  const byPosition = new Map<string, { slot: number; playerId: string }[]>();
  for (const e of chart.entries) {
    (byPosition.get(e.position) ?? byPosition.set(e.position, []).get(e.position)!).push(e);
  }
  const rows = [...byPosition.entries()].map(([position, entries]) => ({
    position,
    ordered: [...entries].sort((a, b) => a.slot - b.slot),
  }));

  const sourceLabel =
    chart.source === 'MANUAL' ? 'Manual' : chart.source === 'IMPORTED' ? 'Imported' : 'Auto-generated';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Depth Chart</h1>
          <p className="text-muted-foreground text-sm mt-1">
            <Link
              href={`/leagues/${leagueId}/teams/${teamId}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {team.teamName}
            </Link>{' '}
            · {sourceLabel}
          </p>
        </div>
        <Badge variant={chart.legal ? 'secondary' : 'destructive'}>
          {chart.legal ? 'Complete' : 'Missing starters'}
        </Badge>
      </div>

      {team.canEditColors ? (
        <DepthChartEditor teamId={teamId} players={team.players} initialEntries={chart.entries} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lineup</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pos</TableHead>
                  <TableHead>Starter</TableHead>
                  <TableHead>Backups</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.position}>
                    <TableCell className="font-medium">{r.position}</TableCell>
                    <TableCell>{nameById.get(r.ordered[0]?.playerId) ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.ordered
                        .slice(1)
                        .map((e) => nameById.get(e.playerId) ?? '—')
                        .join(', ') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
