import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { TeamDetailDto, PlayerRatingsDto, TeamColorsDto } from '@heritage-saturday/shared';
import { TeamColorsEditor } from '@/components/team-colors-editor';
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
import { PlayerAvatar } from '@/components/player-avatar';

// The team-color fields, in display order.
const COLOR_FIELDS: { key: keyof TeamColorsDto; label: string }[] = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent' },
  { key: 'helmetColor', label: 'Helmet' },
  { key: 'homeJerseyColor', label: 'Home jersey' },
  { key: 'awayJerseyColor', label: 'Away jersey' },
];

// The full rating grid, in scouting-sheet order. Labels are the conventional 3-letter
// abbreviations; a cell is "—" when the attribute doesn't apply to that player's position.
const RATING_COLUMNS: { key: keyof PlayerRatingsDto; label: string }[] = [
  { key: 'speed', label: 'SPD' },
  { key: 'strength', label: 'STR' },
  { key: 'awareness', label: 'AWR' },
  { key: 'throwPower', label: 'THP' },
  { key: 'throwAccuracy', label: 'THA' },
  { key: 'catching', label: 'CAT' },
  { key: 'routeRunning', label: 'RTE' },
  { key: 'carry', label: 'CAR' },
  { key: 'trucking', label: 'TRK' },
  { key: 'passBlock', label: 'PBK' },
  { key: 'runBlock', label: 'RBK' },
  { key: 'tackle', label: 'TCK' },
  { key: 'coverage', label: 'COV' },
  { key: 'kickPower', label: 'KPW' },
  { key: 'kickAccuracy', label: 'KAC' },
];

/**
 * Server Component: a team's page — branding, conference/division/coach, and the roster with
 * every rating attribute, each player linking to their own page.
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
          <h1 className="text-xl font-bold tracking-tight">{team.teamName}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
        {team.coachName && (
          <Badge variant="secondary">Coach: {team.coachName}</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Colors</CardTitle>
        </CardHeader>
        <CardContent>
          {team.canEditColors ? (
            <TeamColorsEditor teamId={team.id} colors={team} />
          ) : COLOR_FIELDS.some((f) => team![f.key]) ? (
            <div className="flex flex-wrap gap-4">
              {COLOR_FIELDS.filter((f) => team![f.key]).map((f) => (
                <div key={f.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-6 w-6 rounded border"
                    style={{ background: team![f.key] as string }}
                  />
                  <span className="text-muted-foreground">{f.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No colors set.</p>
          )}
        </CardContent>
      </Card>

      {(team.band || team.rival) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {team.band && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{team.band.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm flex flex-col gap-2">
                <div>
                  <span className="text-muted-foreground">Style: </span>
                  {team.band.style}
                </div>
                <div>
                  <span className="text-muted-foreground">Signature chant: </span>
                  <span className="italic">“{team.band.chant}”</span>
                </div>
                <p className="text-muted-foreground">{team.band.tradition}</p>
              </CardContent>
            </Card>
          )}
          {team.rival && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rivalry</CardTitle>
              </CardHeader>
              <CardContent className="text-sm flex flex-col gap-2">
                <div>
                  <span className="text-muted-foreground">Rival: </span>
                  <Link
                    href={`/leagues/${leagueId}/teams/${team.rival.teamId}`}
                    className="font-medium underline underline-offset-2 hover:text-foreground"
                  >
                    {team.rival.teamName}
                  </Link>
                </div>
                {team.rival.classicGameName && (
                  <div>
                    <span className="text-muted-foreground">The annual meeting: </span>
                    {team.rival.classicGameName}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
                <TableHead className="whitespace-nowrap">Player</TableHead>
                <TableHead>Pos</TableHead>
                <TableHead className="text-right">OVR</TableHead>
                {RATING_COLUMNS.map((c) => (
                  <TableHead key={c.key} className="text-right" title={c.key}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.players.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{p.jerseyNumber}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <PlayerAvatar
                        url={p.headshotUrl}
                        name={`${p.firstName} ${p.lastName}`}
                        size={24}
                      />
                      <Link
                        href={`/leagues/${leagueId}/players/${p.id}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {p.firstName} {p.lastName}
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell>{p.position}</TableCell>
                  <TableCell className="text-right font-medium">{p.overallRating}</TableCell>
                  {RATING_COLUMNS.map((c) => (
                    <TableCell key={c.key} className="text-right tabular-nums">
                      {p[c.key] ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
