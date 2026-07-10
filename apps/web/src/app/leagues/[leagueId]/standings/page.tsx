import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { StandingsResponseDto } from '@heritage-saturday/shared';
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

/** Server Component: standings, one table per conference/division, sorted by wins then diff. */
export default async function StandingsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  let standings: StandingsResponseDto | null = null;
  let error: string | null = null;
  try {
    standings = await serverApiClient.get<StandingsResponseDto>(`/leagues/${leagueId}/standings`);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load standings.';
  }

  if (error || !standings) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load standings</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const empty = standings.groups.every((g) => g.rows.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Standings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Win–loss, points for/against, and differential from completed season games.
        </p>
      </div>

      {empty && (
        <p className="text-muted-foreground text-sm">
          No teams yet. Generate a schedule and simulate a week to populate standings.
        </p>
      )}

      {standings.groups.map((group) => (
        <Card key={`${group.conference}-${group.division}`}>
          <CardHeader>
            <CardTitle className="text-base">
              {[group.conference, group.division].filter(Boolean).join(' — ') || 'Standings'}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">W</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">PA</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((r) => (
                  <TableRow key={r.teamId}>
                    <TableCell>
                      <Link
                        href={`/leagues/${leagueId}/teams/${r.teamId}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {r.teamName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">{r.wins}</TableCell>
                    <TableCell className="text-right">{r.losses}</TableCell>
                    <TableCell className="text-right">{r.pointsFor}</TableCell>
                    <TableCell className="text-right">{r.pointsAgainst}</TableCell>
                    <TableCell className="text-right">
                      {r.differential > 0 ? `+${r.differential}` : r.differential}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
