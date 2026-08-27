-- Existing vehicles are retained as CAR until an administrator corrects their type.
CREATE TYPE "VehicleType" AS ENUM ('BIKE', 'CAR');

ALTER TABLE "Vehicle"
ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR';