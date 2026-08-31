-- AlterTable
ALTER TABLE "User" ADD COLUMN "auth0Sub" TEXT;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_auth0Sub_key" ON "User"("auth0Sub");
