import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { LeadersResponseDto } from '@heritage-saturday/shared';
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

/** Server Component: season stat leaders, one card per category (top 10), from completed games. */
export default async function LeadersPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  let leaders: LeadersResponseDto | null = null;
  let error: string | null = null;
  try {
    leaders = await serverApiClient.get<LeadersResponseDto>(`/leagues/${leagueId}/leaders`);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load leaders.';
  }

  if (error || !leaders) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load leaders</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const empty = leaders.categories.every((c) => c.rows.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Season Leaders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Top players by category across completed season games.
        </p>
      </div>

      {empty && (
        <p className="text-muted-foreground text-sm">
          No stats yet. Simulate season games to populate the leaderboards.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {leaders.categories
          .filter((c) => c.rows.length > 0)
          .map((c) => (
            <Card key={c.key}>
              <CardHeader>
                <CardTitle className="text-base">{c.label}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-right">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">
                        {c.unit ? c.unit.toUpperCase() : 'Total'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.rows.map((r, i) => (
                      <TableRow key={r.playerId}>
                        <TableCell
                          className={`text-right tabular-nums ${i === 0 ? 'text-brand-accent font-bold' : 'text-muted-foreground'}`}
                        >
                          {i + 1}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Link
                            href={`/leagues/${leagueId}/players/${r.playerId}`}
                            className="underline underline-offset-2 hover:text-foreground"
                          >
                            {r.playerName}
                          </Link>
                          <span className="text-muted-foreground ml-1 text-xs">{r.position}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <Link
                            href={`/leagues/${leagueId}/teams/${r.teamId}`}
                            className="hover:text-foreground hover:underline underline-offset-2"
                          >
                            {r.teamName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {r.value.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
