import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { LeagueListItemDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Server Component: the league dashboard. Every roster, game, and import lives inside one of
 * these leagues, so this is the app's home after sign-in.
 */
export default async function LeaguesPage() {
  let leagues: LeagueListItemDto[] = [];
  let loadError: string | null = null;

  try {
    leagues = await serverApiClient.get<LeagueListItemDto[]>('/leagues');
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Failed to load leagues.';
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Your Leagues</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create a league from a template to start playing, or set one up for your own rosters.
          </p>
        </div>
        <Button size="sm" render={<Link href="/leagues/new" />}>
          New League
        </Button>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load leagues</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {!loadError && leagues.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No leagues yet. Create your first one to get started.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {leagues.map((league) => (
          <Card key={league.id}>
            <Link href={`/leagues/${league.id}`}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{league.name}</CardTitle>
                <div className="flex gap-1">
                  {league.role !== 'OWNER' && <Badge variant="outline">Shared with you</Badge>}
                  <Badge variant={league.templateKey ? 'default' : 'secondary'}>
                    {league.templateKey ? 'Generated' : 'Custom'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {league.teamCount} {league.teamCount === 1 ? 'team' : 'teams'} · created{' '}
                {new Date(league.createdAt).toLocaleDateString()}
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
