-- Capability 2: introduce the League container and backfill existing rows.
--
-- Roster/Game/RosterImport gain a required leagueId. The tables are non-empty (leftover dev
-- data), so this cannot be a bare ADD COLUMN ... NOT NULL. Instead: create League, add the
-- columns nullable, backfill one default league per distinct owner, then enforce NOT NULL.
-- Child rows keep their own ownerId/userId untouched, so existing OwnershipGuards are unchanged.

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "templateKey" TEXT,
    "seed" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "League_ownerId_idx" ON "League"("ownerId");

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add leagueId NULLABLE first so the backfill can populate it.
ALTER TABLE "Game" ADD COLUMN     "leagueId" TEXT;
ALTER TABLE "Roster" ADD COLUMN     "leagueId" TEXT;
ALTER TABLE "RosterImport" ADD COLUMN     "leagueId" TEXT;

-- Backfill: one default league per distinct owner across all three tables. templateKey NULL
-- marks it a legacy/imported league (not template-generated); size 0 because no preset created
-- it. The synthetic id ('lg_' || owner) is deterministic and unique per owner. Every ownerId /
-- userId is a valid User (existing FKs), so League_ownerId_fkey holds.
INSERT INTO "League" ("id", "ownerId", "name", "size", "templateKey", "seed", "visibility", "createdAt")
SELECT 'lg_' || owner_id, owner_id, 'My League', 0, NULL, 'migrated', 'PRIVATE', CURRENT_TIMESTAMP
FROM (
  SELECT "ownerId" AS owner_id FROM "Roster"
  UNION
  SELECT "ownerId" AS owner_id FROM "Game"
  UNION
  SELECT "userId" AS owner_id FROM "RosterImport"
) AS owners;

UPDATE "Roster"       SET "leagueId" = 'lg_' || "ownerId";
UPDATE "Game"         SET "leagueId" = 'lg_' || "ownerId";
UPDATE "RosterImport" SET "leagueId" = 'lg_' || "userId";

-- Now the columns are fully populated, enforce NOT NULL.
ALTER TABLE "Game" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "Roster" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "RosterImport" ALTER COLUMN "leagueId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Game_leagueId_createdAt_idx" ON "Game"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "Roster_leagueId_idx" ON "Roster"("leagueId");

-- CreateIndex
CREATE INDEX "RosterImport_leagueId_createdAt_idx" ON "RosterImport"("leagueId", "createdAt");

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
