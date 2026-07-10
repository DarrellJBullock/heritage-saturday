import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { PlayerDetailDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Attribute label + accessor, in display order. Only populated (non-null) ones are shown, since
// an imported roster need not fill every column.
const ATTRIBUTES: { label: string; key: keyof PlayerDetailDto }[] = [
  { label: 'Speed', key: 'speed' },
  { label: 'Strength', key: 'strength' },
  { label: 'Awareness', key: 'awareness' },
  { label: 'Throw Power', key: 'throwPower' },
  { label: 'Throw Accuracy', key: 'throwAccuracy' },
  { label: 'Catching', key: 'catching' },
  { label: 'Route Running', key: 'routeRunning' },
  { label: 'Carry', key: 'carry' },
  { label: 'Trucking', key: 'trucking' },
  { label: 'Pass Block', key: 'passBlock' },
  { label: 'Run Block', key: 'runBlock' },
  { label: 'Tackle', key: 'tackle' },
  { label: 'Coverage', key: 'coverage' },
  { label: 'Kick Power', key: 'kickPower' },
  { label: 'Kick Accuracy', key: 'kickAccuracy' },
];

/**
 * Server Component: a player's page — identity, overall, owning team, and every populated
 * rating attribute.
 */
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ leagueId: string; playerId: string }>;
}) {
  const { leagueId, playerId } = await params;

  let player: PlayerDetailDto | null = null;
  let error: string | null = null;
  try {
    player = await serverApiClient.get<PlayerDetailDto>(`/players/${playerId}`);
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Failed to load player.';
  }

  if (error || !player) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load player</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const ratings = ATTRIBUTES.map((a) => ({ label: a.label, value: player![a.key] as number | null })).filter(
    (r) => r.value !== null && r.value !== undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            #{player.jerseyNumber} {player.firstName} {player.lastName}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {player.position}
            {player.archetype ? ` · ${player.archetype}` : ''} ·{' '}
            <Link
              href={`/leagues/${leagueId}/teams/${player.teamId}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {player.teamName}
            </Link>
          </p>
        </div>
        <Badge className="text-base">OVR {player.overallRating}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attributes</CardTitle>
        </CardHeader>
        <CardContent>
          {ratings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No detailed attributes recorded for this player.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {ratings.map((r) => (
                <div key={r.label} className="flex items-center justify-between border-b py-1">
                  <dt className="text-muted-foreground text-sm">{r.label}</dt>
                  <dd className="font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
