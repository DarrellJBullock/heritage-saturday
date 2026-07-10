import { Injectable } from '@nestjs/common';
import { BaseOwnershipGuard } from './base-ownership.guard';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RosterOwnershipGuard extends BaseOwnershipGuard {
  protected paramName = 'id';
  protected async resolveOwnerId(prisma: PrismaService, resourceId: string): Promise<string | null> {
    const roster = await prisma.roster.findUnique({ where: { id: resourceId }, select: { ownerId: true } });
    return roster?.ownerId ?? null;
  }
}

@Injectable()
export class TeamOwnershipGuard extends BaseOwnershipGuard {
  protected paramName = 'id';
  protected async resolveOwnerId(prisma: PrismaService, resourceId: string): Promise<string | null> {
    const team = await prisma.team.findUnique({
      where: { id: resourceId },
      select: { roster: { select: { ownerId: true } } },
    });
    return team?.roster.ownerId ?? null;
  }
}

/** For routes where the owned resource is a team, but the route param is `teamId`. */
@Injectable()
export class TeamByParamOwnershipGuard extends BaseOwnershipGuard {
  protected paramName = 'teamId';
  protected async resolveOwnerId(prisma: PrismaService, resourceId: string): Promise<string | null> {
    const team = await prisma.team.findUnique({
      where: { id: resourceId },
      select: { roster: { select: { ownerId: true } } },
    });
    return team?.roster.ownerId ?? null;
  }
}

@Injectable()
export class GameOwnershipGuard extends BaseOwnershipGuard {
  protected paramName = 'id';
  protected async resolveOwnerId(prisma: PrismaService, resourceId: string): Promise<string | null> {
    const game = await prisma.game.findUnique({ where: { id: resourceId }, select: { ownerId: true } });
    return game?.ownerId ?? null;
  }
}

@Injectable()
export class ImportOwnershipGuard extends BaseOwnershipGuard {
  protected paramName = 'id';
  protected async resolveOwnerId(prisma: PrismaService, resourceId: string): Promise<string | null> {
    const imp = await prisma.rosterImport.findUnique({ where: { id: resourceId }, select: { userId: true } });
    return imp?.userId ?? null;
  }
}
