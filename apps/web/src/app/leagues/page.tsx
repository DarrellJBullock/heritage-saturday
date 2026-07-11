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
    <div className="flex flex-col gap-6">
      <div className="from-brand-strong via-brand to-brand-strong animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br p-6 shadow-lg duration-500">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Your Leagues</h1>
          <p className="mt-1 max-w-md text-sm text-white/70">
            Create a league from a template to start playing, or set one up for your own rosters.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 shadow"
          render={<Link href="/leagues/new" />}
        >
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

      <div className="grid gap-3 sm:grid-cols-2">
        {leagues.map((league) => (
          <Card
            key={league.id}
            className="hover:border-brand/40 border-l-4 border-l-transparent transition-all duration-200 hover:-translate-y-0.5 hover:border-l-brand-accent hover:shadow-md"
          >
            <Link href={`/leagues/${league.id}`} className="block">
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
