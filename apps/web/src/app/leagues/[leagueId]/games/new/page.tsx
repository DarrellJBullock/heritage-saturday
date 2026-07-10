'use client';

// Client Component: this whole flow is interactive selection state (roster,
// two teams, per-team archetypes) that must persist across re-renders as the
// user changes selections and triggers async loads (teams, depth charts) and
// finally submits "Run Game". Zustand (useGameSetupStore) holds the
// in-progress selections per the architecture's client-state guidance.

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type {
  LeagueDetailDto,
  RosterListItemDto,
  TeamSummaryDto,
  DepthChartResponseDto,
  SimulateGameRequestDto,
  SimulateGameResponseDto,
  OffensiveArchetype,
  DefensiveArchetype,
} from '@heritage-saturday/shared';
import { OFFENSIVE_ARCHETYPES, DEFENSIVE_ARCHETYPES } from '@heritage-saturday/shared';
import { useGameSetupStore } from '@/store/game-setup-store';
import {
  OFFENSIVE_ARCHETYPE_LABELS,
  DEFENSIVE_ARCHETYPE_LABELS,
} from '@/lib/archetype-labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function useDepthChart(teamId: string | null) {
  const [depthChart, setDepthChart] = useState<DepthChartResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!teamId) {
      return;
    }
    let cancelled = false;
    // Standard "fetch on prop change" effect pattern — this rule flags any
    // setState in an effect, including the conventional loading/error reset
    // before an async fetch kicks off; intentional here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    apiClient
      .get<DepthChartResponseDto>(`/depth-charts/${teamId}`)
      .then((data) => {
        if (!cancelled) setDepthChart(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load depth chart.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // Derive the displayed value instead of resetting state imperatively when
  // the selection is cleared (avoids a setState-in-effect anti-pattern).
  return {
    depthChart: teamId ? depthChart : null,
    error: teamId ? error : null,
    isLoading: teamId ? isLoading : false,
  };
}

function TeamPanel({
  label,
  teams,
  selectedTeamId,
  onSelectTeam,
  disabledTeamId,
  offArchetype,
  defArchetype,
  onOffArchetypeChange,
  onDefArchetypeChange,
}: {
  label: string;
  teams: TeamSummaryDto[];
  selectedTeamId: string | null;
  onSelectTeam: (id: string | null) => void;
  disabledTeamId: string | null;
  offArchetype: OffensiveArchetype;
  defArchetype: DefensiveArchetype;
  onOffArchetypeChange: (v: OffensiveArchetype) => void;
  onDefArchetypeChange: (v: DefensiveArchetype) => void;
}) {
  const { depthChart, error, isLoading } = useDepthChart(selectedTeamId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Select value={selectedTeamId ?? undefined} onValueChange={onSelectTeam}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((team) => (
              <SelectItem
                key={team.id}
                value={team.id}
                disabled={team.id === disabledTeamId}
              >
                {team.teamName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTeamId && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Offensive Archetype</label>
              <Select
                value={offArchetype}
                onValueChange={(v) => onOffArchetypeChange(v as OffensiveArchetype)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFENSIVE_ARCHETYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {OFFENSIVE_ARCHETYPE_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Defensive Archetype</label>
              <Select
                value={defArchetype}
                onValueChange={(v) => onDefArchetypeChange(v as DefensiveArchetype)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFENSIVE_ARCHETYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {DEFENSIVE_ARCHETYPE_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Depth Chart</span>
                {depthChart && <Badge variant="secondary">{depthChart.source}</Badge>}
              </div>
              {isLoading && (
                <p className="text-xs text-muted-foreground">Loading depth chart…</p>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {depthChart && depthChart.warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>Unfilled positions</AlertTitle>
                  <AlertDescription>{depthChart.warnings.join('; ')}</AlertDescription>
                </Alert>
              )}
              {depthChart && (
                <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
                  {depthChart.entries
                    .filter((e) => e.slot === 0)
                    .map((entry) => (
                      <li key={`${entry.position}-${entry.slot}`}>
                        {entry.position}: player #{entry.playerId.slice(-4)}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function GameSetupPage() {
  const router = useRouter();
  const { leagueId } = useParams<{ leagueId: string }>();
  const [rosters, setRosters] = useState<RosterListItemDto[]>([]);
  const [teams, setTeams] = useState<TeamSummaryDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const {
    rosterId,
    homeTeamId,
    awayTeamId,
    homeOffArchetype,
    homeDefArchetype,
    awayOffArchetype,
    awayDefArchetype,
    setRosterId,
    setHomeTeamId,
    setAwayTeamId,
    setHomeOffArchetype,
    setHomeDefArchetype,
    setAwayOffArchetype,
    setAwayDefArchetype,
  } = useGameSetupStore();

  useEffect(() => {
    // Only this league's rosters, not every roster the user owns — a game is played within
    // one league, so offering teams from another would only produce a 400 at simulate time.
    apiClient
      .get<LeagueDetailDto>(`/leagues/${leagueId}`)
      .then((league) => {
        setRosters(league.rosters);
        if (!rosterId && league.rosters.length > 0) setRosterId(league.rosters[0].id);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load rosters.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  useEffect(() => {
    if (!rosterId) {
      return;
    }
    let cancelled = false;
    apiClient
      .get<TeamSummaryDto[]>(`/teams?rosterId=${rosterId}`)
      .then((data) => {
        if (!cancelled) setTeams(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : 'Failed to load teams.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rosterId]);

  const { depthChart: homeDepthChart } = useDepthChart(homeTeamId);
  const { depthChart: awayDepthChart } = useDepthChart(awayTeamId);

  // Derived rather than reset imperatively when rosterId is cleared.
  const visibleTeams = rosterId ? teams : [];

  const teamsSelectedAndDistinct = Boolean(
    homeTeamId && awayTeamId && homeTeamId !== awayTeamId,
  );
  const eitherTeamUnfillable =
    homeDepthChart?.legal === false || awayDepthChart?.legal === false;

  const canRunGame = useMemo(
    () => teamsSelectedAndDistinct,
    [teamsSelectedAndDistinct],
  );

  async function handleRunGame() {
    if (!homeTeamId || !awayTeamId) return;
    setIsRunning(true);
    setRunError(null);
    const body: SimulateGameRequestDto = {
      homeTeamId,
      awayTeamId,
      homeOffArchetype,
      homeDefArchetype,
      awayOffArchetype,
      awayDefArchetype,
    };
    try {
      const result = await apiClient.post<SimulateGameResponseDto>(
        `/leagues/${leagueId}/games/simulate`,
        body,
      );
      router.push(`/leagues/${leagueId}/games/${result.gameId}/box-score`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorCode === 'UNFILLABLE_POSITIONS') {
          const positions = (err.detail?.positions as string[] | undefined)?.join(', ');
          setRunError(
            `One of the selected teams cannot field a legal lineup${
              positions ? ` (unfilled: ${positions})` : ''
            }.`,
          );
        } else {
          setRunError(err.message);
        }
      } else {
        setRunError('An unexpected error occurred while starting the game.');
      }
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Set Up a Game</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick two different teams, review their depth charts, and choose an archetype
          for each side.
        </p>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load rosters/teams</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {rosters.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Roster</label>
          <Select value={rosterId ?? undefined} onValueChange={setRosterId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a roster" />
            </SelectTrigger>
            <SelectContent>
              {rosters.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {rosters.length === 0 && !loadError && (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any committed rosters yet. Import one first.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TeamPanel
          label="Home Team"
          teams={visibleTeams}
          selectedTeamId={homeTeamId}
          onSelectTeam={(id) => setHomeTeamId(id)}
          disabledTeamId={awayTeamId}
          offArchetype={homeOffArchetype}
          defArchetype={homeDefArchetype}
          onOffArchetypeChange={setHomeOffArchetype}
          onDefArchetypeChange={setHomeDefArchetype}
        />
        <TeamPanel
          label="Away Team"
          teams={visibleTeams}
          selectedTeamId={awayTeamId}
          onSelectTeam={(id) => setAwayTeamId(id)}
          disabledTeamId={homeTeamId}
          offArchetype={awayOffArchetype}
          defArchetype={awayDefArchetype}
          onOffArchetypeChange={setAwayOffArchetype}
          onDefArchetypeChange={setAwayDefArchetype}
        />
      </div>

      {runError && (
        <Alert variant="destructive">
          <AlertTitle>Run Game failed</AlertTitle>
          <AlertDescription>{runError}</AlertDescription>
        </Alert>
      )}

      {!teamsSelectedAndDistinct && (
        <p className="text-xs text-muted-foreground">
          Select two different teams to enable Run Game.
        </p>
      )}
      {teamsSelectedAndDistinct && eitherTeamUnfillable && (
        <p className="text-xs text-muted-foreground">
          Note: at least one team has unfilled positions (see warnings above); the engine
          may still be able to run a minimum-viable lineup.
        </p>
      )}

      <Button onClick={handleRunGame} disabled={!canRunGame || isRunning} className="w-fit">
        {isRunning ? 'Running…' : 'Run Game'}
      </Button>
    </div>
  );
}
