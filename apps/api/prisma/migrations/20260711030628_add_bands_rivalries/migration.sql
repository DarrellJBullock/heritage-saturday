-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "classicGameName" TEXT,
ADD COLUMN     "rivalTeamId" TEXT;

-- CreateTable
CREATE TABLE "Band" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "chant" TEXT NOT NULL,
    "tradition" TEXT NOT NULL,

    CONSTRAINT "Band_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Band_teamId_key" ON "Band"("teamId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_rivalTeamId_fkey" FOREIGN KEY ("rivalTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Band" ADD CONSTRAINT "Band_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
