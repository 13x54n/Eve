-- CreateEnum
CREATE TYPE "TripDispatchStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "TripDispatch" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "TripDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripDispatch_tripId_driverId_key" ON "TripDispatch"("tripId", "driverId");

-- CreateIndex
CREATE INDEX "TripDispatch_driverId_status_expiresAt_idx" ON "TripDispatch"("driverId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "TripDispatch_tripId_status_idx" ON "TripDispatch"("tripId", "status");

-- AddForeignKey
ALTER TABLE "TripDispatch" ADD CONSTRAINT "TripDispatch_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripDispatch" ADD CONSTRAINT "TripDispatch_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
