-- AlterTable
ALTER TABLE "AdminSession" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "AdminSession" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "AdminSession" ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- Existing login-log rows cannot be used to refresh.
UPDATE "AdminSession"
SET
  "tokenHash" = 'legacy-' || "id",
  "expiresAt" = COALESCE("expiresAt", NOW()),
  "revokedAt" = COALESCE("revokedAt", NOW())
WHERE "tokenHash" IS NULL;

ALTER TABLE "AdminSession" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "AdminSession" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_userId_expiresAt_idx" ON "AdminSession"("userId", "expiresAt");
