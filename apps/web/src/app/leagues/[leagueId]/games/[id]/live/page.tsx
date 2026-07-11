import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type {
  PlayByPlayResponseDto,
  BoxScoreResponseDto,
  TeamDetailDto,
} from '@heritage-saturday/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LiveViewer } from '@/components/live-viewer/live-viewer';

/** Server Component: replays a finished game. Fetches the play feed, final score, and team
 * colors, then hands them to the client LiveViewer (which owns playback + the PixiJS scene). */
export default async function LivePage({
  params,
}: {
  params: Promise<{ leagueId: string; id: string }>;
}) {
  const { leagueId, id } = await params;

  let pbp: PlayByPlayResponseDto | null = null;
  let box: BoxScoreResponseDto | null = null;
  let error: string | null = null;
  try {
    [pbp, box] = await Promise.all([
      serverApiClient.get<PlayByPlayResponseDto>(`/leagues/${leagueId}/games/${id}/plays`),
      serverApiClient.get<BoxScoreResponseDto>(`/leagues/${leagueId}/games/${id}/box-score`),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load the game.';
  }

  if (error || !pbp || !box) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the live viewer</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const boxScoreHref = `/leagues/${leagueId}/games/${id}/box-score`;
  if (pbp.plays.length === 0) {
    return (
      <Alert>
        <AlertTitle>No plays to replay</AlertTitle>
        <AlertDescription>
          This game has no play-by-play data.{' '}
          <Link href={boxScoreHref} className="underline underline-offset-2">
            View the box score
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  // Team colors for the field end zones (best-effort).
  const [homeTeam, awayTeam] = await Promise.all([
    serverApiClient.get<TeamDetailDto>(`/teams/${pbp.teams.home.id}`).catch(() => null),
    serverApiClient.get<TeamDetailDto>(`/teams/${pbp.teams.away.id}`).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Live Viewer</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pbp.teams.away.teamName} at {pbp.teams.home.teamName}
          </p>
        </div>
        <Button size="sm" variant="outline" render={<Link href={boxScoreHref} />}>
          Box score
        </Button>
      </div>

      <LiveViewer
        homeName={pbp.teams.home.teamName}
        awayName={pbp.teams.away.teamName}
        homeColorHex={homeTeam?.primaryColor ?? null}
        awayColorHex={awayTeam?.primaryColor ?? null}
        finalScore={box.finalScore}
        plays={pbp.plays}
      />
    </div>
  );
}
