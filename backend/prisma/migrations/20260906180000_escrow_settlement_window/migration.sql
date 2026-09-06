-- AlterEnum
ALTER TYPE "LedgerStatus" ADD VALUE 'SETTLING';

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "escrowStartTx" TEXT,
ADD COLUMN "escrowSettleFrom" TIMESTAMP(3),
ADD COLUMN "escrowDisputeTx" TEXT;
