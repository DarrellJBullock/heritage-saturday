import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { RosterDetailDto, RosterListItemDto } from '@heritage-saturday/shared';

@Injectable()
export class RostersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOwner(ownerId: string): Promise<RosterListItemDto[]> {
    const rosters = await this.prisma.roster.findMany({
      where: { ownerId },
      include: { _count: { select: { teams: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rosters.map((r) => ({
      id: r.id,
      name: r.name,
      teamCount: r._count.teams,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getDetail(rosterId: string, ownerId: string): Promise<RosterDetailDto> {
    const roster = await this.prisma.roster.findFirst({
      where: { id: rosterId, ownerId },
      include: { teams: true },
    });
    if (!roster) {
      throw new DomainException(404, 'NOT_FOUND', 'Roster not found');
    }

    return {
      id: roster.id,
      name: roster.name,
      teamCount: roster.teams.length,
      createdAt: roster.createdAt.toISOString(),
      teams: roster.teams.map((t) => ({
        id: t.id,
        externalTeamId: t.externalTeamId,
        teamName: t.teamName,
        abbreviation: t.abbreviation,
        city: t.city,
        state: t.state,
        conference: t.conference,
        division: t.division,
      })),
    };
  }
}
