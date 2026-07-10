import { DefensiveArchetype, OffensiveArchetype } from '@heritage-saturday/shared';

export class SimulateGameDto {
  homeTeamId!: string;
  awayTeamId!: string;
  homeOffArchetype!: OffensiveArchetype;
  homeDefArchetype!: DefensiveArchetype;
  awayOffArchetype!: OffensiveArchetype;
  awayDefArchetype!: DefensiveArchetype;
  seed?: string;
}
