import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { ScheduleResponseDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScheduleActions } from './schedule-actions';

/**
 * Server Component: the season schedule, grouped by week. Mutating actions (generate / simulate
 * a week) live in the ScheduleActions client component, which refreshes this on success.
 */
export default async function SchedulePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  let schedule: ScheduleResponseDto | null = null;
  let error: string | null = null;
  try {
    schedule = await serverApiClient.get<ScheduleResponseDto>(`/leagues/${leagueId}/schedule`);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load schedule.';
  }

  if (error || !schedule) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load schedule</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const hasSchedule = schedule.weeks.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hasSchedule
              ? schedule.nextWeek === null
                ? 'Season complete.'
                : `Next up: week ${schedule.nextWeek}.`
              : 'No schedule yet — generate a round-robin to start the season.'}
          </p>
        </div>
        <ScheduleActions leagueId={leagueId} hasSchedule={hasSchedule} nextWeek={schedule.nextWeek} />
      </div>

      {schedule.weeks.map(({ week, games }) => (
        <Card key={week}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Week {week}</CardTitle>
            {week === schedule.nextWeek && <Badge>Next</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {games.map((g) => {
              const played = g.status === 'COMPLETE';
              const row = (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      {g.away.teamName} <span className="text-muted-foreground">at</span>{' '}
                      {g.home.teamName}
                    </span>
                    {g.classicGameName ? (
                      <Badge variant="secondary">{g.classicGameName}</Badge>
                    ) : g.isRivalry ? (
                      <Badge variant="secondary">Rivalry</Badge>
                    ) : null}
                    {g.isHomecoming && (
                      <Badge variant="outline">Homecoming</Badge>
                    )}
                  </span>
                  <span className={played ? 'font-medium' : 'text-muted-foreground'}>
                    {played ? `${g.awayScore} – ${g.homeScore}` : 'scheduled'}
                  </span>
                </div>
              );
              return played ? (
                <Link
                  key={g.gameId}
                  href={`/leagues/${leagueId}/games/${g.gameId}/box-score`}
                  className="hover:bg-muted/50 rounded px-2 -mx-2"
                >
                  {row}
                </Link>
              ) : (
                <div key={g.gameId} className="px-2 -mx-2">
                  {row}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
