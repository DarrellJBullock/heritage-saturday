-- CreateEnum
CREATE TYPE "LeagueRole" AS ENUM ('COMMISSIONER', 'MANAGER', 'VIEWER');

-- AlterTable
ALTER TABLE "LeagueMember" ADD COLUMN     "role" "LeagueRole" NOT NULL DEFAULT 'VIEWER';
