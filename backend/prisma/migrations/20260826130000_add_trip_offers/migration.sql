CREATE TYPE "TripOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

CREATE TABLE "TripOffer" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "proposedFare" DECIMAL(12,2) NOT NULL,
    "etaMinutes" INTEGER NOT NULL,
    "status" "TripOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "TripOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TripOffer_tripId_driverId_key" ON "TripOffer"("tripId", "driverId");
CREATE INDEX "TripOffer_tripId_status_createdAt_idx" ON "TripOffer"("tripId", "status", "createdAt");
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;