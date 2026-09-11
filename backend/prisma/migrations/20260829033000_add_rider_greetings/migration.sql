-- CreateEnum
CREATE TYPE "GreetingMode" AS ENUM ('PINNED', 'ROTATE');

-- CreateTable
CREATE TABLE "Greeting" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Greeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreetingSettings" (
    "id" TEXT NOT NULL,
    "mode" "GreetingMode" NOT NULL DEFAULT 'PINNED',
    "pinnedGreetingId" TEXT,

    CONSTRAINT "GreetingSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GreetingSettings" ADD CONSTRAINT "GreetingSettings_pinnedGreetingId_fkey" FOREIGN KEY ("pinnedGreetingId") REFERENCES "Greeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default copy so production is not empty before seed
INSERT INTO "Greeting" ("id", "template", "enabled", "createdAt", "updatedAt") VALUES
  ('greeting_nice', 'Nice to see you, {name}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('greeting_back', 'Good to have you back, {name}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('greeting_where', 'Where to, {name}?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "GreetingSettings" ("id", "mode", "pinnedGreetingId") VALUES
  ('default', 'PINNED', 'greeting_nice');
