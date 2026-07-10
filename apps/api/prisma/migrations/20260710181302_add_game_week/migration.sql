-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "week" INTEGER;

-- CreateIndex
CREATE INDEX "Game_leagueId_week_idx" ON "Game"("leagueId", "week");
