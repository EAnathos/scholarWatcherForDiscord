-- CreateTable
CREATE TABLE "WatchChannel" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchChannel_guildId_channelId_key" ON "WatchChannel"("guildId", "channelId");

-- AddForeignKey
ALTER TABLE "WatchChannel" ADD CONSTRAINT "WatchChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: create a WatchChannel for each guild that had a channelId
INSERT INTO "WatchChannel" ("guildId", "channelId")
SELECT "id", "channelId" FROM "Guild" WHERE "channelId" IS NOT NULL;

-- Add new column to Keyword
ALTER TABLE "Keyword" ADD COLUMN "watchChannelId" INTEGER;

-- Migrate keywords to their guild's WatchChannel
UPDATE "Keyword" k
SET "watchChannelId" = wc."id"
FROM "WatchChannel" wc
WHERE wc."guildId" = k."guildId";

-- Delete orphaned keywords (guilds that had no channelId)
DELETE FROM "Keyword" WHERE "watchChannelId" IS NULL;

-- Make watchChannelId non-nullable
ALTER TABLE "Keyword" ALTER COLUMN "watchChannelId" SET NOT NULL;

-- Drop old index and foreign key
DROP INDEX "Keyword_guildId_value_key";
ALTER TABLE "Keyword" DROP CONSTRAINT "Keyword_guildId_fkey";
ALTER TABLE "Keyword" DROP COLUMN "guildId";

-- Add new constraint and foreign key
CREATE UNIQUE INDEX "Keyword_watchChannelId_value_key" ON "Keyword"("watchChannelId", "value");
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_watchChannelId_fkey" FOREIGN KEY ("watchChannelId") REFERENCES "WatchChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop channelId from Guild
ALTER TABLE "Guild" DROP COLUMN "channelId";
