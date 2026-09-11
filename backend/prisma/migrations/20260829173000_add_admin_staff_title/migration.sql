-- CreateEnum
CREATE TYPE "AdminStaffTitle" AS ENUM ('MANAGER', 'MEMBER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "adminStaffTitle" "AdminStaffTitle";

-- Existing department admins keep hiring rights as managers.
UPDATE "User"
SET "adminStaffTitle" = 'MANAGER'
WHERE "role" = 'ADMIN'
  AND "adminStaffRole" IS NOT NULL
  AND "adminStaffRole" <> 'OWNER';
