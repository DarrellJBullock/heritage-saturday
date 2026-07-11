import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import {
  PlayerDto,
  RosterPlayerDto,
  SetTeamColorsRequestDto,
  TeamDetailDto,
  TeamSummaryDto,
} from '@heritage-saturday/shared';
import { Player } from '@prisma/client';
import { isLeagueMember } from '../common/guards/base-read-access.guard';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full team detail for the team page. Read access (owner or league member) is enforced by
   * TeamReadAccessGuard on the route; `canEditColors` is true only for the owner. */
  async getDetail(teamId: string, userId: string): Promise<TeamDetailDto> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        players: { orderBy: { jerseyNumber: 'asc' } },
        band: true,
        rival: { select: { id: true, teamName: true } },
        roster: { select: { ownerId: true, leagueId: true } },
      },
    });
    if (!team) {
      throw new DomainException(404, 'NOT_FOUND', 'Team not found');
    }

    // Non-blocking color advisories (spec: warn on low contrast or a palette duplicated in the
    // league). HEX validity is already enforced on write, so these are purely advisory.
    const colorWarnings: string[] = [];
    if (team.primaryColor && team.secondaryColor) {
      const ratio = contrastRatio(team.primaryColor, team.secondaryColor);
      if (ratio !== null && ratio < 1.5) {
        colorWarnings.push('Primary and secondary colors are very similar — they may be hard to tell apart.');
      }
    }
    if (team.primaryColor) {
      const clash = await this.prisma.team.findFirst({
        where: {
          id: { not: teamId },
          roster: { leagueId: team.roster.leagueId },
          primaryColor: { equals: team.primaryColor, mode: 'insensitive' },
        },
        select: { teamName: true },
      });
      if (clash) {
        colorWarnings.push(`Shares its primary color with ${clash.teamName}.`);
      }
    }

    return {
      id: team.id,
      externalTeamId: team.externalTeamId,
      teamName: team.teamName,
      abbreviation: team.abbreviation,
      city: team.city,
      state: team.state,
      conference: team.conference,
      division: team.division,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      accentColor: team.accentColor,
      helmetColor: team.helmetColor,
      homeJerseyColor: team.homeJerseyColor,
      awayJerseyColor: team.awayJerseyColor,
      coachName: team.coachName,
      players: team.players.map(toRosterPlayerDto),
      band: team.band
        ? { name: team.band.name, style: team.band.style, chant: team.band.chant, tradition: team.band.tradition }
        : null,
      rival: team.rival
        ? { teamId: team.rival.id, teamName: team.rival.teamName, classicGameName: team.classicGameName }
        : null,
      canEditColors: team.roster.ownerId === userId,
      colorWarnings,
    };
  }

  /** Set a team's colors. Owner-only (TeamOwnershipGuard on the route). Each value must be a
   * #rgb / #rrggbb HEX string, or null/blank to clear. */
  async setColors(teamId: string, dto: SetTeamColorsRequestDto, userId: string): Promise<TeamDetailDto> {
    await this.prisma.team.update({
      where: { id: teamId },
      data: {
        primaryColor: normalizeHex(dto?.primaryColor, 'primary'),
        secondaryColor: normalizeHex(dto?.secondaryColor, 'secondary'),
        accentColor: normalizeHex(dto?.accentColor, 'accent'),
        helmetColor: normalizeHex(dto?.helmetColor, 'helmet'),
        homeJerseyColor: normalizeHex(dto?.homeJerseyColor, 'home jersey'),
        awayJerseyColor: normalizeHex(dto?.awayJerseyColor, 'away jersey'),
      },
    });
    return this.getDetail(teamId, userId);
  }

  async listForRoster(rosterId: string, userId: string): Promise<TeamSummaryDto[]> {
    // Access enforced here (rosterId is a query param, not a route param a guard can see):
    // the owner always, or a member of the league when the roster is LEAGUE-visible. 404 (not
    // 403) on denial, matching the ownership/read-access guards.
    const roster = await this.prisma.roster.findUnique({
      where: { id: rosterId },
      select: { ownerId: true, leagueId: true, visibility: true },
    });
    const allowed =
      roster &&
      (roster.ownerId === userId ||
        (roster.visibility === 'LEAGUE' && (await isLeagueMember(this.prisma, roster.leagueId, userId))));
    if (!allowed) {
      throw new DomainException(404, 'NOT_FOUND', 'Roster not found');
    }

    // Unique per roster (@@unique([rosterId, externalTeamId])), so this is a total order.
    // Without it the list order follows the query plan and can change between reads.
    const teams = await this.prisma.team.findMany({
      where: { rosterId },
      orderBy: { externalTeamId: 'asc' },
    });
    return teams.map((t) => ({
      id: t.id,
      externalTeamId: t.externalTeamId,
      teamName: t.teamName,
      abbreviation: t.abbreviation,
      city: t.city,
      state: t.state,
      conference: t.conference,
      division: t.division,
    }));
  }

  async listPlayers(teamId: string): Promise<PlayerDto[]> {
    // Ownership already enforced by TeamOwnershipGuard at the controller boundary.
    const players = await this.prisma.player.findMany({ where: { teamId }, orderBy: { jerseyNumber: 'asc' } });
    return players.map(toPlayerDto);
  }
}

/** The summary shape of a Player, shared by the roster list and the team page. */
function toPlayerDto(p: {
  id: string;
  externalPlayerId: string;
  firstName: string;
  lastName: string;
  position: PlayerDto['position'];
  jerseyNumber: number;
  overallRating: number;
  archetype: string | null;
  headshotUrl: string | null;
}): PlayerDto {
  return {
    id: p.id,
    externalPlayerId: p.externalPlayerId,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    jerseyNumber: p.jerseyNumber,
    overallRating: p.overallRating,
    archetype: p.archetype,
    headshotUrl: p.headshotUrl,
  };
}

/** A roster row with every rating attribute, for the team page's ratings grid. */
function toRosterPlayerDto(p: Player): RosterPlayerDto {
  return {
    ...toPlayerDto(p),
    speed: p.speed,
    strength: p.strength,
    awareness: p.awareness,
    throwPower: p.throwPower,
    throwAccuracy: p.throwAccuracy,
    catching: p.catching,
    routeRunning: p.routeRunning,
    carry: p.carry,
    trucking: p.trucking,
    passBlock: p.passBlock,
    runBlock: p.runBlock,
    tackle: p.tackle,
    coverage: p.coverage,
    kickPower: p.kickPower,
    kickAccuracy: p.kickAccuracy,
  };
}

/** Parse #rgb / #rrggbb to [r,g,b] 0-255, or null if unparseable. */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '');
  const full = m.length === 3 ? m.replace(/(.)/g, '$1$1') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** WCAG contrast ratio (1..21) between two HEX colors, or null if either can't be parsed. */
function contrastRatio(a: string, b: string): number | null {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return null;
  const lum = ([r, g, b]: [number, number, number]) => {
    const chan = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  };
  const l1 = lum(rgbA);
  const l2 = lum(rgbB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Validate a #rgb / #rrggbb HEX color, or null/blank to clear. Throws a 400 on a bad value. */
function normalizeHex(raw: string | null | undefined, label: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    throw new DomainException(400, 'BAD_REQUEST', `${label} color must be a HEX value like #1a2b3c`);
  }
  return trimmed.toLowerCase();
}
