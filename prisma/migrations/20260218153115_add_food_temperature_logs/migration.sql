-- CreateEnum
CREATE TYPE "FoodTempStatus" AS ENUM ('OK', 'OUT_OF_RANGE', 'DISCARDED', 'REHEATED', 'COOLED');

-- CreateTable
CREATE TABLE "foodTemperatureLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logDate" TIMESTAMP(3) NOT NULL,
    "period" "LogPeriod",
    "status" "FoodTempStatus" NOT NULL DEFAULT 'OK',
    "foodName" TEXT NOT NULL,
    "tempC" DECIMAL(5,2),
    "notes" TEXT,
    "eventId" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "foodTemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foodTemperatureLog_propertyId_logDate_idx" ON "foodTemperatureLog"("propertyId", "logDate");

-- CreateIndex
CREATE INDEX "foodTemperatureLog_propertyId_eventId_logDate_idx" ON "foodTemperatureLog"("propertyId", "eventId", "logDate");
