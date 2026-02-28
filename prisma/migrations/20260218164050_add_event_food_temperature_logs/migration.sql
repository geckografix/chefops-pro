-- CreateTable
CREATE TABLE "eventFoodTemperatureLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logDate" TIMESTAMP(3) NOT NULL,
    "period" "LogPeriod",
    "status" "FoodTempStatus" NOT NULL DEFAULT 'OK',
    "foodName" TEXT NOT NULL,
    "tempC" DECIMAL(5,2),
    "notes" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "eventFoodTemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventFoodTemperatureLog_propertyId_eventDate_idx" ON "eventFoodTemperatureLog"("propertyId", "eventDate");

-- CreateIndex
CREATE INDEX "eventFoodTemperatureLog_propertyId_eventId_eventDate_idx" ON "eventFoodTemperatureLog"("propertyId", "eventId", "eventDate");
