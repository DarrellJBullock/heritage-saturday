import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  simulateGame,
  SimInputTeam,
  SimulationInput,
  SimulationResult,
} from '@heritage-saturday/simulation-engine';
import {
  DEFENSIVE_ARCHETYPES,
  OFFENSIVE_ARCHETYPES,
  BoxScoreResponseDto,
  DriveSummaryDto,
  PerformerDto,
  PlayerGameStatsDto,
  SimulateGameResponseDto,
  WinProbabilityPointDto,
} from '@heritage-saturday/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { DepthChartsService } from '../depth-charts/depth-charts.service';
import { DomainException } from '../common/errors/domain-exception';
import { SimulateGameDto } from './dto/simulate-game.dto';

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depthChartsService: DepthChartsService,
  ) {}

  async simulate(dto: SimulateGameDto, ownerId: string, leagueId: string): Promise<SimulateGameResponseDto> {
    this.validateArchetypes(dto);

    if (dto.homeTeamId === dto.awayTeamId) {
      throw new DomainException(400, 'BAD_REQUEST', 'homeTeamId and awayTeamId must be different teams');
    }

    const [homeTeam, awayTeam] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: dto.homeTeamId }, include: { roster: true } }),
      this.prisma.team.findUnique({ where: { id: dto.awayTeamId }, include: { roster: true } }),
    ]);

    // Authorization to simulate in this league is enforced by the capability guard on the route.
    // Here we only require both teams to belong to that league — not that the caller owns them,
    // so a commissioner can play games with the owner's teams.
    if (!homeTeam || homeTeam.roster.leagueId !== leagueId) {
      throw new DomainException(400, 'BAD_REQUEST', 'homeTeamId is not a team in this league');
    }
    if (!awayTeam || awayTeam.roster.leagueId !== leagueId) {
      throw new DomainException(400, 'BAD_REQUEST', 'awayTeamId is not a team in this league');
    }

    const [homeLegality, awayLegality] = await Promise.all([
      this.depthChartsService.checkLegality(dto.homeTeamId),
      this.depthChartsService.checkLegality(dto.awayTeamId),
    ]);

    if (!homeLegality.legal) {
      throw new DomainException(422, 'UNFILLABLE_POSITIONS', 'Home team roster cannot fill required starting positions', {
        teamId: dto.homeTeamId,
        positions: homeLegality.unfilled,
      });
    }
    if (!awayLegality.legal) {
      throw new DomainException(422, 'UNFILLABLE_POSITIONS', 'Away team roster cannot fill required starting positions', {
        teamId: dto.awayTeamId,
        positions: awayLegality.unfilled,
      });
    }

    const seed = dto.seed ?? randomUUID();

    const [homeSimTeam, awaySimTeam] = await Promise.all([
      this.buildSimTeam(dto.homeTeamId, dto.homeOffArchetype, dto.homeDefArchetype),
      this.buildSimTeam(dto.awayTeamId, dto.awayOffArchetype, dto.awayDefArchetype),
    ]);

    const input: SimulationInput = { home: homeSimTeam, away: awaySimTeam, seed };
    const result = simulateGame(input);

    const game = await this.prisma.$transaction(async (tx) => {
      const createdGame = await tx.game.create({
        data: {
          ownerId,
          leagueId,
          homeTeamId: dto.homeTeamId,
          awayTeamId: dto.awayTeamId,
          homeOffArchetype: dto.homeOffArchetype,
          homeDefArchetype: dto.homeDefArchetype,
          awayOffArchetype: dto.awayOffArchetype,
          awayDefArchetype: dto.awayDefArchetype,
          seed,
          status: 'COMPLETE',
          homeScore: result.finalScore.home,
          awayScore: result.finalScore.away,
          completedAt: new Date(),
        },
      });

      await this.writeResults(tx, createdGame.id, dto.homeTeamId, dto.awayTeamId, result);
      return createdGame;
    });

    return {
      gameId: game.id,
      status: 'COMPLETE',
      homeScore: result.finalScore.home,
      awayScore: result.finalScore.away,
      seed,
    };
  }

  /**
   * Play a scheduled (PENDING) game: run the engine with the game's own stored seed/archetypes
   * and persist the result, flipping it to COMPLETE. Shares the write path with `simulate` so
   * a season game and a one-off game produce identical rows. Used by ScheduleService per week.
   */
  async playScheduledGame(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new DomainException(404, 'NOT_FOUND', 'Game not found');
    }
    if (game.status === 'COMPLETE') return; // idempotent — already played

    const [homeLegality, awayLegality] = await Promise.all([
      this.depthChartsService.checkLegality(game.homeTeamId),
      this.depthChartsService.checkLegality(game.awayTeamId),
    ]);
    if (!homeLegality.legal || !awayLegality.legal) {
      const teamId = !homeLegality.legal ? game.homeTeamId : game.awayTeamId;
      throw new DomainException(422, 'UNFILLABLE_POSITIONS', 'A scheduled team cannot fill required starting positions', {
        teamId,
        positions: (!homeLegality.legal ? homeLegality : awayLegality).unfilled,
      });
    }

    const [homeSimTeam, awaySimTeam] = await Promise.all([
      this.buildSimTeam(game.homeTeamId, game.homeOffArchetype, game.homeDefArchetype),
      this.buildSimTeam(game.awayTeamId, game.awayOffArchetype, game.awayDefArchetype),
    ]);
    const result = simulateGame({ home: homeSimTeam, away: awaySimTeam, seed: game.seed });

    await this.prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: game.id },
        data: {
          status: 'COMPLETE',
          homeScore: result.finalScore.home,
          awayScore: result.finalScore.away,
          completedAt: new Date(),
        },
      });
      await this.writeResults(tx, game.id, game.homeTeamId, game.awayTeamId, result);
    });
  }

  /**
   * Persist a simulation result's events and team/player stats for an already-created game row.
   * Shared by `simulate` (fresh game) and `playScheduledGame` (existing PENDING game).
   */
  private async writeResults(
    tx: Prisma.TransactionClient,
    gameId: string,
    homeTeamId: string,
    awayTeamId: string,
    result: SimulationResult,
  ): Promise<void> {
    if (result.events.length > 0) {
      await tx.gameEvent.createMany({
        data: result.events.map((e) => ({
          gameId,
          quarter: e.quarter,
          sequence: e.sequence,
          type: e.type,
          teamId: e.teamId,
          payload: e.payload as object,
        })),
      });
    }

    const quarterFor = (side: 'home' | 'away', quarter: number): number =>
      result.quarterByQuarter.find((q) => q.quarter === quarter)?.[side] ?? 0;

    await tx.teamGameStats.createMany({
      data: [
        {
          gameId,
          teamId: homeTeamId,
          q1: quarterFor('home', 1),
          q2: quarterFor('home', 2),
          q3: quarterFor('home', 3),
          q4: quarterFor('home', 4),
          ot: quarterFor('home', 5),
          totalYards: result.teamStats.home.totalYards,
          passingYards: result.teamStats.home.passingYards,
          rushingYards: result.teamStats.home.rushingYards,
          turnovers: result.teamStats.home.turnovers,
          timeOfPossessionSeconds: result.teamStats.home.timeOfPossessionSeconds,
        },
        {
          gameId,
          teamId: awayTeamId,
          q1: quarterFor('away', 1),
          q2: quarterFor('away', 2),
          q3: quarterFor('away', 3),
          q4: quarterFor('away', 4),
          ot: quarterFor('away', 5),
          totalYards: result.teamStats.away.totalYards,
          passingYards: result.teamStats.away.passingYards,
          rushingYards: result.teamStats.away.rushingYards,
          turnovers: result.teamStats.away.turnovers,
          timeOfPossessionSeconds: result.teamStats.away.timeOfPossessionSeconds,
        },
      ],
    });

    if (result.playerStats.length > 0) {
      await tx.playerGameStats.createMany({
        data: result.playerStats.map((p) => ({
          gameId,
          playerId: p.playerId,
          teamId: p.teamId,
          passAttempts: p.passAttempts,
          passCompletions: p.passCompletions,
          passYards: p.passYards,
          passTDs: p.passTDs,
          interceptions: p.interceptions,
          carries: p.carries,
          rushYards: p.rushYards,
          rushTDs: p.rushTDs,
          targets: p.targets,
          receptions: p.receptions,
          receivingYards: p.receivingYards,
          receivingTDs: p.receivingTDs,
          tackles: p.tackles,
          sacks: p.sacks,
          defInterceptions: p.defInterceptions,
          fgMade: p.fgMade,
          fgAttempts: p.fgAttempts,
          xpMade: p.xpMade,
        })),
      });
    }
  }

  async getBoxScore(gameId: string, leagueId: string): Promise<BoxScoreResponseDto> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: true,
        awayTeam: true,
        teamStats: true,
        // Without an explicit order, Postgres may return these rows in any order, and the
        // order it happens to pick changes with the query plan (seq scan yields physical
        // order; an index scan yields index order). Two reads of the same finished game
        // then serialize to different JSON, which looks exactly like re-simulation drift.
        // playerId is unique per game (@@unique([gameId, playerId])), so this is total.
        playerStats: { include: { player: true }, orderBy: { playerId: 'asc' } },
        // Drive-level events, ordered, for the drive feed and win-probability timeline.
        events: { orderBy: { sequence: 'asc' } },
      },
    });

    // Access to the league is enforced by the read-access guard; also confirm the game is
    // actually in that league so a game id from elsewhere can't be read through this path.
    if (!game || game.leagueId !== leagueId) {
      throw new DomainException(404, 'NOT_FOUND', 'Game not found');
    }

    const homeStats = game.teamStats.find((s) => s.teamId === game.homeTeamId);
    const awayStats = game.teamStats.find((s) => s.teamId === game.awayTeamId);

    const quarterByQuarter = [1, 2, 3, 4, 5]
      .filter((q) => q < 5 || (homeStats?.ot ?? 0) > 0 || (awayStats?.ot ?? 0) > 0)
      .map((quarter) => ({
        quarter,
        home: quarter === 5 ? homeStats?.ot ?? 0 : (homeStats as Record<string, number> | undefined)?.[`q${quarter}`] ?? 0,
        away: quarter === 5 ? awayStats?.ot ?? 0 : (awayStats as Record<string, number> | undefined)?.[`q${quarter}`] ?? 0,
      }));

    const toStatsDto = (s: typeof homeStats) => ({
      totalYards: s?.totalYards ?? 0,
      passingYards: s?.passingYards ?? 0,
      rushingYards: s?.rushingYards ?? 0,
      turnovers: s?.turnovers ?? 0,
      timeOfPossessionSeconds: s?.timeOfPossessionSeconds ?? null,
    });

    const homePlayerStats = game.playerStats
      .filter((p) => p.teamId === game.homeTeamId)
      .map((p) => ({
        playerId: p.playerId,
        firstName: p.player.firstName,
        lastName: p.player.lastName,
        position: p.player.position,
        passAttempts: p.passAttempts ?? undefined,
        passCompletions: p.passCompletions ?? undefined,
        passYards: p.passYards ?? undefined,
        passTDs: p.passTDs ?? undefined,
        interceptions: p.interceptions ?? undefined,
        carries: p.carries ?? undefined,
        rushYards: p.rushYards ?? undefined,
        rushTDs: p.rushTDs ?? undefined,
        targets: p.targets ?? undefined,
        receptions: p.receptions ?? undefined,
        receivingYards: p.receivingYards ?? undefined,
        receivingTDs: p.receivingTDs ?? undefined,
        tackles: p.tackles ?? undefined,
        sacks: p.sacks ?? undefined,
        defInterceptions: p.defInterceptions ?? undefined,
        fgMade: p.fgMade ?? undefined,
        fgAttempts: p.fgAttempts ?? undefined,
        xpMade: p.xpMade ?? undefined,
      }));

    const awayPlayerStats = game.playerStats
      .filter((p) => p.teamId === game.awayTeamId)
      .map((p) => ({
        playerId: p.playerId,
        firstName: p.player.firstName,
        lastName: p.player.lastName,
        position: p.player.position,
        passAttempts: p.passAttempts ?? undefined,
        passCompletions: p.passCompletions ?? undefined,
        passYards: p.passYards ?? undefined,
        passTDs: p.passTDs ?? undefined,
        interceptions: p.interceptions ?? undefined,
        carries: p.carries ?? undefined,
        rushYards: p.rushYards ?? undefined,
        rushTDs: p.rushTDs ?? undefined,
        targets: p.targets ?? undefined,
        receptions: p.receptions ?? undefined,
        receivingYards: p.receivingYards ?? undefined,
        receivingTDs: p.receivingTDs ?? undefined,
        tackles: p.tackles ?? undefined,
        sacks: p.sacks ?? undefined,
        defInterceptions: p.defInterceptions ?? undefined,
        fgMade: p.fgMade ?? undefined,
        fgAttempts: p.fgAttempts ?? undefined,
        xpMade: p.xpMade ?? undefined,
      }));

    const homeName = game.homeTeam.teamName;
    const awayName = game.awayTeam.teamName;
    const finalScore = { home: game.homeScore ?? 0, away: game.awayScore ?? 0 };

    const drives = this.buildDrives(game.events, game.homeTeamId, homeName, awayName);
    const leaders = {
      home: this.buildLeaders(homePlayerStats),
      away: this.buildLeaders(awayPlayerStats),
    };
    const winProbability = this.buildWinProbability(game.events, game.homeTeamId, finalScore);
    const recap = this.buildRecap(homeName, awayName, finalScore, [...homePlayerStats, ...awayPlayerStats]);

    return {
      gameId: game.id,
      seed: game.seed,
      status: game.status,
      teams: {
        home: { id: game.homeTeam.id, teamName: homeName },
        away: { id: game.awayTeam.id, teamName: awayName },
      },
      finalScore,
      quarterByQuarter,
      teamStats: { home: toStatsDto(homeStats), away: toStatsDto(awayStats) },
      playerStats: { home: homePlayerStats, away: awayPlayerStats },
      drives,
      leaders,
      winProbability,
      recap,
    };
  }

  // ---- Game Center derivations (from the stored game; no re-simulation) --------------------

  /** One entry per possession, from the DRIVE_END events (points from the following SCORE). */
  private buildDrives(
    events: { type: string; teamId: string | null; quarter: number; payload: unknown }[],
    homeTeamId: string,
    homeName: string,
    awayName: string,
  ): DriveSummaryDto[] {
    const drives: DriveSummaryDto[] = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.type !== 'DRIVE_END') continue;
      const payload = (e.payload ?? {}) as { outcome?: string; yards?: number };
      const side: 'home' | 'away' = e.teamId === homeTeamId ? 'home' : 'away';
      const next = events[i + 1];
      const points =
        next && next.type === 'SCORE' && next.teamId === e.teamId
          ? ((next.payload ?? {}) as { points?: number }).points ?? 0
          : 0;
      drives.push({
        quarter: e.quarter,
        side,
        teamName: side === 'home' ? homeName : awayName,
        yards: payload.yards ?? 0,
        outcome: payload.outcome ?? 'DRIVE',
        points,
      });
    }
    return drives;
  }

  /** Leading passer/rusher/receiver and a defensive standout for a team. */
  private buildLeaders(players: PlayerGameStatsDto[]): PerformerDto[] {
    const leaders: PerformerDto[] = [];
    const best = (key: (p: PlayerGameStatsDto) => number) =>
      players.reduce<PlayerGameStatsDto | null>(
        (top, p) => (key(p) > (top ? key(top) : 0) ? p : top),
        null,
      );

    const passer = best((p) => p.passYards ?? 0);
    if (passer && (passer.passYards ?? 0) > 0) {
      leaders.push(this.performer(passer, 'PASSING',
        `${passer.passCompletions ?? 0}/${passer.passAttempts ?? 0}, ${passer.passYards} yds` +
        (passer.passTDs ? `, ${passer.passTDs} TD` : '') +
        (passer.interceptions ? `, ${passer.interceptions} INT` : '')));
    }
    const rusher = best((p) => p.rushYards ?? 0);
    if (rusher && (rusher.rushYards ?? 0) > 0) {
      leaders.push(this.performer(rusher, 'RUSHING',
        `${rusher.carries ?? 0} car, ${rusher.rushYards} yds` +
        (rusher.rushTDs ? `, ${rusher.rushTDs} TD` : '')));
    }
    const receiver = best((p) => p.receivingYards ?? 0);
    if (receiver && (receiver.receivingYards ?? 0) > 0) {
      leaders.push(this.performer(receiver, 'RECEIVING',
        `${receiver.receptions ?? 0} rec, ${receiver.receivingYards} yds` +
        (receiver.receivingTDs ? `, ${receiver.receivingTDs} TD` : '')));
    }
    const defender = best((p) => (p.tackles ?? 0) + (p.sacks ?? 0));
    if (defender && (defender.tackles ?? 0) + (defender.sacks ?? 0) > 0) {
      leaders.push(this.performer(defender, 'DEFENSE',
        `${defender.tackles ?? 0} tkl` +
        (defender.sacks ? `, ${defender.sacks} sack` : '') +
        (defender.defInterceptions ? `, ${defender.defInterceptions} INT` : '')));
    }
    return leaders;
  }

  private performer(p: PlayerGameStatsDto, role: PerformerDto['role'], line: string): PerformerDto {
    return { playerId: p.playerId, name: `${p.firstName} ${p.lastName}`, position: p.position, role, line };
  }

  /**
   * A lightweight, deterministic win-probability timeline for the home team: 0.5 at kickoff, a
   * point after each score (logistic on running margin, sharpened as the game runs out), and a
   * terminal point pinned to the actual winner so the chart never contradicts the result.
   */
  private buildWinProbability(
    events: { type: string; teamId: string | null; quarter: number; payload: unknown }[],
    homeTeamId: string,
    finalScore: { home: number; away: number },
  ): WinProbabilityPointDto[] {
    const points: WinProbabilityPointDto[] = [{ quarter: 1, homeWinProb: 0.5 }];
    let home = 0;
    let away = 0;
    let lastQuarter = 1;
    for (const e of events) {
      if (e.type !== 'SCORE') continue;
      const pts = ((e.payload ?? {}) as { points?: number }).points ?? 0;
      if (e.teamId === homeTeamId) home += pts;
      else away += pts;
      lastQuarter = e.quarter;
      const margin = home - away;
      const quartersLeft = Math.max(0, 4 - e.quarter);
      const scale = 2 + quartersLeft * 3; // softer early, sharper late
      points.push({ quarter: e.quarter, homeWinProb: round2(1 / (1 + Math.exp(-margin / scale))) });
    }
    const terminal = finalScore.home === finalScore.away ? 0.5 : finalScore.home > finalScore.away ? 1 : 0;
    points.push({ quarter: lastQuarter, homeWinProb: terminal });
    return points;
  }

  private buildRecap(
    homeName: string,
    awayName: string,
    finalScore: { home: number; away: number },
    allPlayers: PlayerGameStatsDto[],
  ): string {
    const { home, away } = finalScore;
    let lead: string;
    if (home === away) {
      lead = `The ${homeName} and ${awayName} played to a ${home}–${away} draw.`;
    } else {
      const [winner, loser, ws, ls] =
        home > away ? [homeName, awayName, home, away] : [awayName, homeName, away, home];
      lead = `The ${winner} beat the ${loser} ${ws}–${ls}.`;
    }

    const topBy = (key: (p: PlayerGameStatsDto) => number) =>
      allPlayers.reduce<PlayerGameStatsDto | null>(
        (t, p) => (key(p) > (t ? key(t) : 0) ? p : t),
        null,
      );
    const name = (p: PlayerGameStatsDto) => `${p.firstName} ${p.lastName}`;
    const passer = topBy((p) => p.passYards ?? 0);
    const rusher = topBy((p) => p.rushYards ?? 0);
    const notes: string[] = [];
    if (passer && (passer.passYards ?? 0) > 0) notes.push(`${name(passer)} threw for ${passer.passYards} yards`);
    if (rusher && (rusher.rushYards ?? 0) > 0) notes.push(`${name(rusher)} ran for ${rusher.rushYards}`);
    return notes.length ? `${lead} ${notes.join(', and ')}.` : lead;
  }

  private validateArchetypes(dto: SimulateGameDto): void {
    const offValues: string[] = [...OFFENSIVE_ARCHETYPES];
    const defValues: string[] = [...DEFENSIVE_ARCHETYPES];
    for (const [field, value] of [
      ['homeOffArchetype', dto.homeOffArchetype],
      ['awayOffArchetype', dto.awayOffArchetype],
    ] as const) {
      if (!offValues.includes(value)) {
        throw new DomainException(400, 'BAD_REQUEST', `Invalid ${field}: ${value}`);
      }
    }
    for (const [field, value] of [
      ['homeDefArchetype', dto.homeDefArchetype],
      ['awayDefArchetype', dto.awayDefArchetype],
    ] as const) {
      if (!defValues.includes(value)) {
        throw new DomainException(400, 'BAD_REQUEST', `Invalid ${field}: ${value}`);
      }
    }
  }

  private async buildSimTeam(
    teamId: string,
    offArchetype: SimulateGameDto['homeOffArchetype'],
    defArchetype: SimulateGameDto['homeDefArchetype'],
  ): Promise<SimInputTeam> {
    // Ensures a depth chart exists (auto-generating if needed) before simulating.
    await this.depthChartsService.getOrGenerate(teamId);

    // Both reads are ordered deliberately. The engine breaks ties by array position:
    // `playersAtPosition` falls back to sorting by overallRating (a stable sort, so equal
    // ratings keep input order) and `getStarter` takes players[0]. Real rosters do have
    // two players at one position with an identical rating, so an unordered read would let
    // the query plan decide who starts — same seed, different game.
    const [players, depthChart] = await Promise.all([
      this.prisma.player.findMany({ where: { teamId }, orderBy: { id: 'asc' } }),
      this.prisma.depthChart.findFirst({
        where: { teamId },
        include: { entries: { orderBy: [{ position: 'asc' }, { slot: 'asc' }] } },
        orderBy: { generatedAt: 'desc' },
      }),
    ]);

    return {
      teamId,
      offArchetype,
      defArchetype,
      players: players.map((p) => ({
        id: p.id,
        position: p.position,
        overallRating: p.overallRating,
        throwPower: p.throwPower,
        throwAccuracy: p.throwAccuracy,
        carry: p.carry,
        trucking: p.trucking,
        catching: p.catching,
        routeRunning: p.routeRunning,
        tackle: p.tackle,
        coverage: p.coverage,
        kickPower: p.kickPower,
        kickAccuracy: p.kickAccuracy,
      })),
      depthChart: (depthChart?.entries ?? []).map((e) => ({
        position: e.position,
        slot: e.slot,
        playerId: e.playerId,
      })),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
