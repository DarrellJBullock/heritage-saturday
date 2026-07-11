import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { LeagueDetailDto, RosterDetailDto, TeamSummaryDto } from '@heritage-saturday/shared';
import { hasCapability } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MembersPanel } from './members-panel';
import { RosterVisibility } from './roster-visibility';

/**
 * Server Component: a league's home. Lists its teams (across all its rosters) and the actions
 * that live inside a league — set up a game, import a roster, view import history.
 */
export default async function LeagueHomePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  let league: LeagueDetailDto | null = null;
  let error: string | null = null;
  try {
    league = await serverApiClient.get<LeagueDetailDto>(`/leagues/${leagueId}`);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load league.';
  }

  if (error || !league) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load league</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Teams live under the league's rosters. Fetch each ACTIVE roster's teams so the home page
  // shows the actual teams — archived rosters are hidden from the active view.
  const rosterDetails = await Promise.all(
    league.rosters
      .filter((r) => !r.archived)
      .map((r) =>
        serverApiClient
          .get<RosterDetailDto>(`/rosters/${r.id}`)
          .catch(() => null),
      ),
  );
  const teams: TeamSummaryDto[] = rosterDetails
    .filter((r): r is RosterDetailDto => r !== null)
    .flatMap((r) => r.teams);

  const canPlay = teams.length >= 2;
  const role = league.role;
  const canSimulate = hasCapability(role, 'simulate');
  const canImport = hasCapability(role, 'import');
  const canManageMembers = hasCapability(role, 'members:manage');
  const canSetVisibility = hasCapability(role, 'roster:visibility');
  const roleLabel = role === 'OWNER' ? '' : ` · you are a ${role.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-semibold">{league.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {league.teamCount} {league.teamCount === 1 ? 'team' : 'teams'}
              {league.templateKey ? ' · generated from a template' : ''}
              {roleLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Schedule & standings are readable by any member; New Game needs simulate. */}
          {canPlay && (
            <>
              <Button size="sm" variant="outline" render={<Link href={`/leagues/${leagueId}/schedule`} />}>
                Schedule
              </Button>
              <Button size="sm" variant="outline" render={<Link href={`/leagues/${leagueId}/standings`} />}>
                Standings
              </Button>
              {canSimulate && (
                <Button size="sm" render={<Link href={`/leagues/${leagueId}/games/new`} />}>
                  New Game
                </Button>
              )}
            </>
          )}
          {canImport && (
            <>
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/leagues/${leagueId}/imports/new`} />}
              >
                Import Roster
              </Button>
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/leagues/${leagueId}/imports`} />}
              >
                Import History
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Management panels appear only for roles that can use them. */}
      {(canManageMembers || canSetVisibility) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {canManageMembers && <MembersPanel leagueId={leagueId} />}
          {canSetVisibility && <RosterVisibility rosters={league.rosters} />}
        </div>
      )}

      {teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No teams yet. Import a roster to add teams to this league.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id}>
              <Link href={`/leagues/${leagueId}/teams/${team.id}`}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{team.teamName}</CardTitle>
                  {team.conference && <Badge variant="secondary">{team.conference}</Badge>}
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  {[team.city, team.division].filter(Boolean).join(' · ') || '—'}
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
