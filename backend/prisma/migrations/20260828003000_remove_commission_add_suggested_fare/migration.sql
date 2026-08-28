DELETE FROM "LedgerEntry" WHERE "type" = 'COMMISSION';

ALTER TABLE "Trip" ADD COLUMN "suggestedFare" DECIMAL(12,2);
UPDATE "Trip" SET "suggestedFare" = "fareTotal" WHERE "suggestedFare" IS NULL;
ALTER TABLE "Trip" ALTER COLUMN "suggestedFare" SET NOT NULL;

ALTER TABLE "Trip" DROP COLUMN "commission";
ALTER TABLE "FareConfig" DROP COLUMN "commissionPercent";
ALTER TABLE "DriverProfile" DROP COLUMN "commissionTier";

CREATE TYPE "LedgerType_new" AS ENUM ('CHARGE', 'REFUND', 'PAYOUT', 'WALLET_TOPUP', 'WALLET_WITHDRAW', 'CREDIT', 'ADJUSTMENT');
ALTER TABLE "LedgerEntry" ALTER COLUMN "type" TYPE "LedgerType_new" USING ("type"::text::"LedgerType_new");
DROP TYPE "LedgerType";
ALTER TYPE "LedgerType_new" RENAME TO "LedgerType";
