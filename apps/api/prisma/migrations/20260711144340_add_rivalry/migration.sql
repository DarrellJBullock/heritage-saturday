-- CreateTable
CREATE TABLE "Rivalry" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rivalry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rivalry_leagueId_idx" ON "Rivalry"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Rivalry_leagueId_teamAId_teamBId_key" ON "Rivalry"("leagueId", "teamAId", "teamBId");

-- AddForeignKey
ALTER TABLE "Rivalry" ADD CONSTRAINT "Rivalry_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rivalry" ADD CONSTRAINT "Rivalry_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rivalry" ADD CONSTRAINT "Rivalry_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
