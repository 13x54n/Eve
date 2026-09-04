-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "privyDid" TEXT;
ALTER TABLE "User" ADD COLUMN "ethereumWallet" TEXT;
ALTER TABLE "User" ADD COLUMN "solanaWallet" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_privyDid_key" ON "User"("privyDid");
