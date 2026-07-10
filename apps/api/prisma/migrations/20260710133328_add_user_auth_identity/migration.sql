-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" TEXT,
ADD COLUMN     "authSubject" TEXT;

-- CreateIndex
-- Postgres treats NULLs as distinct, so the seeded fixture users (both columns null)
-- coexist freely while a provider identity can still map to only one account.
CREATE UNIQUE INDEX "User_authProvider_authSubject_key" ON "User"("authProvider", "authSubject");
