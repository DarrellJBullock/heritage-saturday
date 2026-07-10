import { Injectable } from '@nestjs/common';
import { detectFormat, parseFile, ImportParseError, RawImportRow } from '@heritage-saturday/importers';
import { validateImportRows, toStr, toInt } from '@heritage-saturday/validation';
import {
  CommitImportResponseDto,
  ImportHistoryItemDto,
  ImportPreviewResponseDto,
  ImportSummaryDto,
  NON_BLOCKING_SHEETS,
  UploadRosterResponseDto,
} from '@heritage-saturday/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { ENTITY_SHEETS } from './imports.constants';
import { classifyDepthChartRows, DepthChartRowRef } from './depth-chart-projection';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadRoster(
    file: UploadedFile,
    ownerId: string,
    leagueId: string,
  ): Promise<UploadRosterResponseDto> {
    const format = detectFormat(file.originalname, file.mimetype);
    if (!format) {
      throw new DomainException(422, 'UNSUPPORTED_FILE_FORMAT', 'Unrecognized file format', {
        topLevelError: 'Unrecognized file format',
      });
    }

    let rawRows: RawImportRow[];
    try {
      rawRows = parseFile(file.buffer, format);
    } catch (e) {
      const message = e instanceof ImportParseError ? e.message : 'Corrupt or unparseable file';
      await this.prisma.rosterImport.create({
        data: {
          userId: ownerId,
          leagueId,
          fileName: file.originalname,
          fileFormat: format,
          status: 'FAILED',
          topLevelError: message,
        },
      });
      throw new DomainException(422, 'UNSUPPORTED_FILE_FORMAT', message, { topLevelError: message });
    }

    const validated = validateImportRows(rawRows);

    const roImport = await this.prisma.rosterImport.create({
      data: {
        userId: ownerId,
        leagueId,
        fileName: file.originalname,
        fileFormat: format,
        status: 'PENDING',
        rows: {
          create: validated.map((row) => ({
            sheet: row.sheet,
            rowIndex: row.rowIndex,
            rawData: row.raw as object,
            status: row.status,
            messages: row.messages,
            entityRefId: row.entityRefId ?? null,
          })),
        },
      },
    });

    return { importId: roImport.id, status: 'PENDING', topLevelError: null };
  }

  async preview(importId: string, leagueId: string): Promise<ImportPreviewResponseDto> {
    const roImport = await this.prisma.rosterImport.findUnique({
      where: { id: importId },
      include: { rows: true },
    });
    if (!roImport || roImport.leagueId !== leagueId) {
      throw new DomainException(404, 'NOT_FOUND', 'Import not found');
    }

    const summary = this.computeSummary(
      roImport.rows.map((r) => ({ sheet: r.sheet, status: r.status, rawData: r.rawData })),
    );

    return {
      importId: roImport.id,
      fileName: roImport.fileName,
      status: roImport.status,
      summary,
      rows: roImport.rows.map((r) => ({
        sheet: r.sheet,
        rowIndex: r.rowIndex,
        status: r.status,
        messages: r.messages,
        data: r.rawData as Record<string, unknown>,
      })),
    };
  }

  async listForLeague(leagueId: string): Promise<ImportHistoryItemDto[]> {
    const imports = await this.prisma.rosterImport.findMany({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    });

    return imports.map((i) => ({
      importId: i.id,
      fileName: i.fileName,
      createdAt: i.createdAt.toISOString(),
      status: i.status,
      summary: {
        created: i.createdCount,
        updated: i.updatedCount,
        skipped: i.skippedCount,
        failed: i.failedCount,
      },
    }));
  }

  async commit(importId: string, ownerId: string, leagueId: string): Promise<CommitImportResponseDto> {
    const roImport = await this.prisma.rosterImport.findUnique({
      where: { id: importId },
      include: { rows: true },
    });
    if (!roImport) {
      throw new DomainException(404, 'NOT_FOUND', 'Import not found');
    }
    // The import is addressed through a league in the route; it must actually belong to it.
    // 404, not 403, to avoid revealing that the import exists under another league.
    if (roImport.leagueId !== leagueId) {
      throw new DomainException(404, 'NOT_FOUND', 'Import not found');
    }
    if (roImport.status === 'COMMITTED') {
      throw new DomainException(409, 'IMPORT_ALREADY_COMMITTED', 'This import has already been committed');
    }
    if (roImport.status === 'FAILED') {
      throw new DomainException(422, 'UNSUPPORTED_FILE_FORMAT', 'This import failed to parse and cannot be committed', {
        topLevelError: roImport.topLevelError,
      });
    }

    const teamRows = roImport.rows.filter((r) => r.sheet === 'teams' && r.status !== 'ERROR');
    const playerRows = roImport.rows.filter((r) => r.sheet === 'players' && r.status !== 'ERROR');
    const coachRows = roImport.rows.filter((r) => r.sheet === 'coaches' && r.status !== 'ERROR');
    const depthChartRows = roImport.rows.filter((r) => r.sheet === 'depthchart' && r.status !== 'ERROR');

    const failedCount = roImport.rows.filter(
      (r) => r.status === 'ERROR' && (ENTITY_SHEETS as readonly string[]).includes(r.sheet),
    ).length;
    const skippedCount = roImport.rows.filter(
      (r) => (NON_BLOCKING_SHEETS as string[]).includes(r.sheet),
    ).length;

    const result = await this.prisma.$transaction(async (tx) => {
      const roster = await tx.roster.create({
        data: {
          ownerId,
          leagueId: roImport.leagueId,
          name: roImport.fileName,
          visibility: 'PRIVATE',
          sourceImportId: roImport.id,
        },
      });

      const teamIdByExternal = new Map<string, string>();
      for (const row of teamRows) {
        const raw = row.rawData as Record<string, unknown>;
        const team = await tx.team.create({
          data: {
            rosterId: roster.id,
            externalTeamId: toStr(raw.team_id),
            teamName: toStr(raw.team_name),
            abbreviation: raw.abbreviation ? toStr(raw.abbreviation) : null,
            city: raw.city ? toStr(raw.city) : null,
            state: raw.state ? toStr(raw.state) : null,
            conference: raw.conference ? toStr(raw.conference) : null,
            division: raw.division ? toStr(raw.division) : null,
            coachName: raw.coach_name ? toStr(raw.coach_name) : null,
            primaryColor: raw.primary_color ? toStr(raw.primary_color) : null,
            secondaryColor: raw.secondary_color ? toStr(raw.secondary_color) : null,
          },
        });
        teamIdByExternal.set(toStr(raw.team_id), team.id);
      }

      const playerIdByExternal = new Map<string, string>();
      let playersCreated = 0;
      let playersDroppedAsOrphans = 0;
      for (const row of playerRows) {
        const raw = row.rawData as Record<string, unknown>;
        const teamId = teamIdByExternal.get(toStr(raw.team_id));
        if (!teamId) {
          // Team wasn't created (row-level skip, never aborts commit). Validation has
          // already flagged this row WARNING. Count it as skipped — previously it fell
          // into no summary bucket at all, so created+skipped+failed < total rows.
          playersDroppedAsOrphans += 1;
          continue;
        }

        const player = await tx.player.create({
          data: {
            teamId,
            externalPlayerId: toStr(raw.player_id),
            firstName: toStr(raw.first_name),
            lastName: toStr(raw.last_name),
            position: toStr(raw.position).toUpperCase() as never,
            jerseyNumber: toInt(raw.jersey_number) ?? 0,
            archetype: raw.archetype ? toStr(raw.archetype) : null,
            overallRating: toInt(raw.overall_rating) ?? 0,
            speed: toInt(raw.speed),
            strength: toInt(raw.strength),
            awareness: toInt(raw.awareness),
            throwPower: toInt(raw.throw_power),
            throwAccuracy: toInt(raw.throw_accuracy),
            catching: toInt(raw.catching),
            routeRunning: toInt(raw.route_running),
            carry: toInt(raw.carry),
            trucking: toInt(raw.trucking),
            passBlock: toInt(raw.pass_block),
            runBlock: toInt(raw.run_block),
            tackle: toInt(raw.tackle),
            coverage: toInt(raw.coverage),
            kickPower: toInt(raw.kick_power),
            kickAccuracy: toInt(raw.kick_accuracy),
            headshotUrl: raw.headshot_url ? toStr(raw.headshot_url) : null,
            headshotFileName: raw.headshot_file_name ? toStr(raw.headshot_file_name) : null,
            portraitPath: raw.portrait_path ? toStr(raw.portrait_path) : null,
          },
        });
        playerIdByExternal.set(toStr(raw.player_id), player.id);
        playersCreated += 1;
      }

      let coachesCreated = 0;
      let coachesDroppedAsOrphans = 0;
      for (const row of coachRows) {
        const raw = row.rawData as Record<string, unknown>;
        const teamId = teamIdByExternal.get(toStr(raw.team_id));
        if (!teamId) {
          coachesDroppedAsOrphans += 1; // Validation flagged this WARNING; count it as skipped.
          continue;
        }
        await tx.coach.create({
          data: {
            teamId,
            externalCoachId: toStr(raw.coach_id),
            firstName: toStr(raw.first_name),
            lastName: toStr(raw.last_name),
            offensiveStyle: raw.offensive_style ? toStr(raw.offensive_style) : null,
            defensiveStyle: raw.defensive_style ? toStr(raw.defensive_style) : null,
            aggression: toInt(raw.aggression),
            discipline: toInt(raw.discipline),
            development: toInt(raw.development),
            gameManagement: toInt(raw.game_management),
          },
        });
        coachesCreated += 1;
      }

      // DepthChart: only committed per-team if every required starting position
      // is present and complete for that team (architecture.md §5); otherwise
      // left for DepthChartsModule's auto-generation on first read.
      //
      // `created` counts depth-chart ENTRIES (rows), not charts, so that every entity row
      // lands in exactly one summary bucket and `created`/`skipped`/`failed` share a unit.
      const dcRefs: DepthChartRowRef[] = depthChartRows.map((r) => {
        const raw = r.rawData as Record<string, unknown>;
        return {
          externalTeamId: toStr(raw.team_id),
          externalPlayerId: toStr(raw.player_id),
          position: toStr(raw.position),
        };
      });
      const dcWillCreate = classifyDepthChartRows(
        dcRefs,
        new Set(teamIdByExternal.keys()),
        new Set(playerIdByExternal.keys()),
      );

      let depthChartEntriesCreated = 0;
      const depthChartRowsNotCreated = dcWillCreate.filter((created) => !created).length;

      const createdIndicesByTeam = new Map<string, number[]>();
      dcWillCreate.forEach((created, i) => {
        if (!created) return;
        const list = createdIndicesByTeam.get(dcRefs[i].externalTeamId) ?? [];
        list.push(i);
        createdIndicesByTeam.set(dcRefs[i].externalTeamId, list);
      });

      for (const [externalTeamId, indices] of createdIndicesByTeam.entries()) {
        const teamId = teamIdByExternal.get(externalTeamId)!;
        const entriesData = indices.map((i) => {
          const raw = depthChartRows[i].rawData as Record<string, unknown>;
          return {
            position: toStr(raw.position).toUpperCase() as never,
            slot: toInt(raw.slot) ?? 0,
            playerId: playerIdByExternal.get(toStr(raw.player_id))!,
          };
        });

        await tx.depthChart.create({
          data: { teamId, source: 'IMPORTED', entries: { create: entriesData } },
        });
        depthChartEntriesCreated += entriesData.length;
      }

      const summary: ImportSummaryDto = {
        created:
          teamIdByExternal.size + playersCreated + coachesCreated + depthChartEntriesCreated,
        updated: 0,
        // Every non-ERROR entity row that was not written: orphaned players/coaches, plus
        // any depth-chart row dropped for orphaning, an incomplete chart, or an empty chart.
        skipped:
          skippedCount +
          playersDroppedAsOrphans +
          coachesDroppedAsOrphans +
          depthChartRowsNotCreated,
        failed: failedCount,
      };

      await tx.rosterImport.update({
        where: { id: roImport.id },
        data: {
          status: 'COMMITTED',
          committedAt: new Date(),
          createdCount: summary.created,
          updatedCount: summary.updated,
          skippedCount: summary.skipped,
          failedCount: summary.failed,
        },
      });

      return { rosterId: roster.id, summary };
    });

    return result;
  }

  /**
   * Projected (pre-commit) summary shown on the preview screen. Every entity row lands in
   * exactly one bucket, and the units match commit's: `created` counts rows that will be
   * written — including individual depth-chart entries, not whole charts.
   *
   * Non-depthchart sheets: WARNING means orphaned, which commit drops, so it projects as
   * `skipped`. Depthchart rows go through `classifyDepthChartRows`, the same predicate the
   * commit transaction uses, because a row can be dropped for reasons status alone cannot
   * express (an incomplete chart whose rows are individually OK).
   */
  private computeSummary(
    rows: { sheet: string; status: string; rawData: unknown }[],
  ): ImportSummaryDto {
    const isEntity = (r: { sheet: string }) =>
      (ENTITY_SHEETS as readonly string[]).includes(r.sheet);

    const entityRows = rows.filter(isEntity);
    const failed = entityRows.filter((r) => r.status === 'ERROR').length;

    const nonDc = entityRows.filter((r) => r.sheet !== 'depthchart' && r.status !== 'ERROR');
    const createdNonDc = nonDc.filter((r) => r.status === 'OK').length;
    const skippedNonDc = nonDc.filter((r) => r.status === 'WARNING').length;

    // Mirror commit: a team/player is committable iff its own row is OK.
    const okRawOf = (sheet: string) =>
      entityRows
        .filter((r) => r.sheet === sheet && r.status === 'OK')
        .map((r) => r.rawData as Record<string, unknown>);
    const committableTeamIds = new Set(okRawOf('teams').map((raw) => toStr(raw.team_id)));
    const committablePlayerIds = new Set(okRawOf('players').map((raw) => toStr(raw.player_id)));

    const dcRows = entityRows.filter((r) => r.sheet === 'depthchart' && r.status !== 'ERROR');
    const dcWillCreate = classifyDepthChartRows(
      dcRows.map((r) => {
        const raw = r.rawData as Record<string, unknown>;
        return {
          externalTeamId: toStr(raw.team_id),
          externalPlayerId: toStr(raw.player_id),
          position: toStr(raw.position),
        };
      }),
      committableTeamIds,
      committablePlayerIds,
    );
    const createdDc = dcWillCreate.filter(Boolean).length;
    const skippedDc = dcWillCreate.length - createdDc;

    const skipped =
      rows.filter((r) => (NON_BLOCKING_SHEETS as string[]).includes(r.sheet)).length +
      skippedNonDc +
      skippedDc;

    return { created: createdNonDc + createdDc, updated: 0, skipped, failed };
  }
}
