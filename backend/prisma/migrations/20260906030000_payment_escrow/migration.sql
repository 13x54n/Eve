-- AlterEnum
ALTER TYPE "LedgerStatus" ADD VALUE 'ESCROWED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ethereumWalletId" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "escrowDepositTx" TEXT,
ADD COLUMN "escrowReleaseTx" TEXT,
ADD COLUMN "escrowRefundTx" TEXT;
