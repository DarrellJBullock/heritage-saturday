import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { TeamDetailDto } from '@heritage-saturday/shared';
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

/**
 * Server Component: a team's page — branding, conference/division/coach, and the roster, each
 * player linking to their own page.
 */
export default async function TeamPage({
  params,
}: {
  params: Promise<{ leagueId: string; teamId: string }>;
}) {
  const { leagueId, teamId } = await params;

  let team: TeamDetailDto | null = null;
  let error: string | null = null;
  try {
    team = await serverApiClient.get<TeamDetailDto>(`/teams/${teamId}`);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load team.';
  }

  if (error || !team) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load team</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const subtitle = [team.city, team.conference, team.division].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-4">
      {/* A slim bar in the team's colors — its only branding surface today. */}
      <div
        className="h-2 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${team.primaryColor ?? '#888'} 0%, ${
            team.secondaryColor ?? team.primaryColor ?? '#bbb'
          } 100%)`,
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{team.teamName}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
        {team.coachName && (
          <Badge variant="secondary">Coach: {team.coachName}</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Roster ({team.players.length} {team.players.length === 1 ? 'player' : 'players'})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Pos</TableHead>
                <TableHead className="text-right">OVR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.players.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{p.jerseyNumber}</TableCell>
                  <TableCell>
                    <Link
                      href={`/leagues/${leagueId}/players/${p.id}`}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {p.firstName} {p.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{p.position}</TableCell>
                  <TableCell className="text-right font-medium">{p.overallRating}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
