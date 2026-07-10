import { Injectable } from '@nestjs/common';
import { BaseReadAccessGuard, ReadAccessDescriptor } from './base-read-access.guard';
import { PrismaService } from '../prisma/prisma.service';

// A member can read the league shell itself (to navigate in), so it is always member-visible;
// the rosters inside are filtered by visibility in the service.
@Injectable()
export class LeagueReadAccessGuard extends BaseReadAccessGuard {
  protected paramName = 'id';
  protected async resolve(prisma: PrismaService, id: string): Promise<ReadAccessDescriptor | null> {
    const league = await prisma.league.findUnique({ where: { id }, select: { ownerId: true } });
    return league ? { ownerId: league.ownerId, leagueId: id, memberVisible: true } : null;
  }
}

/** Same as LeagueReadAccessGuard but for routes that carry the league id as `leagueId`. */
@Injectable()
export class LeagueByParamReadAccessGuard extends BaseReadAccessGuard {
  protected paramName = 'leagueId';
  protected async resolve(prisma: PrismaService, id: string): Promise<ReadAccessDescriptor | null> {
    const league = await prisma.league.findUnique({ where: { id }, select: { ownerId: true } });
    return league ? { ownerId: league.ownerId, leagueId: id, memberVisible: true } : null;
  }
}

@Injectable()
export class RosterReadAccessGuard extends BaseReadAccessGuard {
  protected paramName = 'id';
  protected async resolve(prisma: PrismaService, id: string): Promise<ReadAccessDescriptor | null> {
    const roster = await prisma.roster.findUnique({
      where: { id },
      select: { ownerId: true, leagueId: true, visibility: true },
    });
    return roster
      ? { ownerId: roster.ownerId, leagueId: roster.leagueId, memberVisible: roster.visibility === 'LEAGUE' }
      : null;
  }
}

@Injectable()
export class TeamReadAccessGuard extends BaseReadAccessGuard {
  protected paramName = 'id';
  protected async resolve(prisma: PrismaService, id: string): Promise<ReadAccessDescriptor | null> {
    return teamDescriptor(prisma, id);
  }
}

/** For routes where the owned resource is a team but the route param is `teamId`. */
@Injectable()
export class TeamByParamReadAccessGuard extends BaseReadAccessGuard {
  protected paramName = 'teamId';
  protected async resolve(prisma: PrismaService, id: string): Promise<ReadAccessDescriptor | null> {
    return teamDescriptor(prisma, id);
  }
}

@Injectable()
export class PlayerReadAccessGuard extends BaseReadAccessGuard {
  protected paramName = 'id';
  protected async resolve(prisma: PrismaService, id: string): Promise<ReadAccessDescriptor | null> {
    const player = await prisma.player.findUnique({
      where: { id },
      select: { team: { select: { roster: { select: { ownerId: true, leagueId: true, visibility: true } } } } },
    });
    const r = player?.team.roster;
    return r ? { ownerId: r.ownerId, leagueId: r.leagueId, memberVisible: r.visibility === 'LEAGUE' } : null;
  }
}

async function teamDescriptor(prisma: PrismaService, teamId: string): Promise<ReadAccessDescriptor | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { roster: { select: { ownerId: true, leagueId: true, visibility: true } } },
  });
  const r = team?.roster;
  return r ? { ownerId: r.ownerId, leagueId: r.leagueId, memberVisible: r.visibility === 'LEAGUE' } : null;
}
