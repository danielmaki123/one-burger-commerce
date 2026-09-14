-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "acceptAlertMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "prepAlertMinutes" INTEGER NOT NULL DEFAULT 15;
