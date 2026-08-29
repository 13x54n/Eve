-- AlterEnum
ALTER TYPE "RideType" ADD VALUE 'COURIER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "recipientName" TEXT;
ALTER TABLE "Trip" ADD COLUMN "recipientPhone" TEXT;
ALTER TABLE "Trip" ADD COLUMN "packageNote" TEXT;
ALTER TABLE "Trip" ADD COLUMN "trackingToken" TEXT;
ALTER TABLE "Trip" ADD COLUMN "recipientUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trip_trackingToken_key" ON "Trip"("trackingToken");
CREATE INDEX "Trip_recipientUserId_status_idx" ON "Trip"("recipientUserId", "status");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
