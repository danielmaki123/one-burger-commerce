-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "chatId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "eventsEnabled" JSONB NOT NULL DEFAULT '[]',
    "refundAlertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "differenceAlertThreshold" DOUBLE PRECISION,
    "lastSentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);
