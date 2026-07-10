-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('OK', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('QB', 'RB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P', 'KR', 'PR');

-- CreateEnum
CREATE TYPE "OffensiveArchetype" AS ENUM ('BALANCED', 'POWER_RUN', 'SPREAD', 'VERTICAL_PASSING', 'WEST_COAST', 'OPTION_RPO', 'PLAY_ACTION_HEAVY');

-- CreateEnum
CREATE TYPE "DefensiveArchetype" AS ENUM ('BALANCED_4_3', 'BASE_3_4', 'NICKEL_ZONE', 'BLITZ_HEAVY', 'MAN_COVERAGE', 'BEND_DONT_BREAK', 'RUN_STOP');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "topLevelError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "RosterImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheet" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "messages" TEXT[],
    "entityRefId" TEXT,

    CONSTRAINT "RosterImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "sourceImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "externalTeamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "abbreviation" TEXT,
    "city" TEXT,
    "state" TEXT,
    "conference" TEXT,
    "division" TEXT,
    "coachName" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "externalPlayerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "jerseyNumber" INTEGER NOT NULL,
    "archetype" TEXT,
    "overallRating" INTEGER NOT NULL,
    "speed" INTEGER,
    "strength" INTEGER,
    "awareness" INTEGER,
    "throwPower" INTEGER,
    "throwAccuracy" INTEGER,
    "catching" INTEGER,
    "routeRunning" INTEGER,
    "carry" INTEGER,
    "trucking" INTEGER,
    "passBlock" INTEGER,
    "runBlock" INTEGER,
    "tackle" INTEGER,
    "coverage" INTEGER,
    "kickPower" INTEGER,
    "kickAccuracy" INTEGER,
    "headshotUrl" TEXT,
    "headshotFileName" TEXT,
    "portraitPath" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "externalCoachId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "offensiveStyle" TEXT,
    "defensiveStyle" TEXT,
    "aggression" INTEGER,
    "discipline" INTEGER,
    "development" INTEGER,
    "gameManagement" INTEGER,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepthChart" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepthChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepthChartEntry" (
    "id" TEXT NOT NULL,
    "depthChartId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "slot" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "DepthChartEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeOffArchetype" "OffensiveArchetype" NOT NULL,
    "homeDefArchetype" "DefensiveArchetype" NOT NULL,
    "awayOffArchetype" "OffensiveArchetype" NOT NULL,
    "awayDefArchetype" "DefensiveArchetype" NOT NULL,
    "seed" TEXT NOT NULL,
    "rulesetVersion" TEXT NOT NULL DEFAULT 'v0',
    "status" "GameStatus" NOT NULL DEFAULT 'PENDING',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "teamId" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamGameStats" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "q1" INTEGER NOT NULL DEFAULT 0,
    "q2" INTEGER NOT NULL DEFAULT 0,
    "q3" INTEGER NOT NULL DEFAULT 0,
    "q4" INTEGER NOT NULL DEFAULT 0,
    "ot" INTEGER NOT NULL DEFAULT 0,
    "totalYards" INTEGER NOT NULL DEFAULT 0,
    "passingYards" INTEGER NOT NULL DEFAULT 0,
    "rushingYards" INTEGER NOT NULL DEFAULT 0,
    "turnovers" INTEGER NOT NULL DEFAULT 0,
    "timeOfPossessionSeconds" INTEGER,

    CONSTRAINT "TeamGameStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStats" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "passAttempts" INTEGER,
    "passCompletions" INTEGER,
    "passYards" INTEGER,
    "passTDs" INTEGER,
    "interceptions" INTEGER,
    "carries" INTEGER,
    "rushYards" INTEGER,
    "rushTDs" INTEGER,
    "targets" INTEGER,
    "receptions" INTEGER,
    "receivingYards" INTEGER,
    "receivingTDs" INTEGER,
    "tackles" INTEGER,
    "sacks" INTEGER,
    "defInterceptions" INTEGER,
    "fgMade" INTEGER,
    "fgAttempts" INTEGER,
    "xpMade" INTEGER,

    CONSTRAINT "PlayerGameStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RosterImport_userId_createdAt_idx" ON "RosterImport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RosterImportRow_importId_sheet_status_idx" ON "RosterImportRow"("importId", "sheet", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_sourceImportId_key" ON "Roster"("sourceImportId");

-- CreateIndex
CREATE INDEX "Roster_ownerId_idx" ON "Roster"("ownerId");

-- CreateIndex
CREATE INDEX "Team_rosterId_idx" ON "Team"("rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_rosterId_externalTeamId_key" ON "Team"("rosterId", "externalTeamId");

-- CreateIndex
CREATE INDEX "Player_teamId_position_idx" ON "Player"("teamId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Player_teamId_externalPlayerId_key" ON "Player"("teamId", "externalPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_teamId_jerseyNumber_key" ON "Player"("teamId", "jerseyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_teamId_key" ON "Coach"("teamId");

-- CreateIndex
CREATE INDEX "DepthChart_teamId_idx" ON "DepthChart"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "DepthChartEntry_depthChartId_position_slot_key" ON "DepthChartEntry"("depthChartId", "position", "slot");

-- CreateIndex
CREATE INDEX "Game_ownerId_createdAt_idx" ON "Game"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_quarter_idx" ON "GameEvent"("gameId", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_gameId_sequence_key" ON "GameEvent"("gameId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TeamGameStats_gameId_teamId_key" ON "TeamGameStats"("gameId", "teamId");

-- CreateIndex
CREATE INDEX "PlayerGameStats_gameId_teamId_idx" ON "PlayerGameStats"("gameId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameStats_gameId_playerId_key" ON "PlayerGameStats"("gameId", "playerId");

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRow" ADD CONSTRAINT "RosterImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "RosterImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "RosterImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepthChart" ADD CONSTRAINT "DepthChart_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepthChartEntry" ADD CONSTRAINT "DepthChartEntry_depthChartId_fkey" FOREIGN KEY ("depthChartId") REFERENCES "DepthChart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepthChartEntry" ADD CONSTRAINT "DepthChartEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGameStats" ADD CONSTRAINT "TeamGameStats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGameStats" ADD CONSTRAINT "TeamGameStats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStats" ADD CONSTRAINT "PlayerGameStats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStats" ADD CONSTRAINT "PlayerGameStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
