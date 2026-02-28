-- CreateEnum
CREATE TYPE "RefrigerationType" AS ENUM ('FRIDGE', 'FREEZER');

-- CreateEnum
CREATE TYPE "LogPeriod" AS ENUM ('AM', 'PM', 'OTHER');

-- CreateTable
CREATE TABLE "RefrigerationUnit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RefrigerationType" NOT NULL DEFAULT 'FRIDGE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefrigerationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemperatureLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "valueC" DECIMAL(5,2) NOT NULL,
    "period" "LogPeriod" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "TemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefrigerationUnit_propertyId_idx" ON "RefrigerationUnit"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "RefrigerationUnit_propertyId_name_key" ON "RefrigerationUnit"("propertyId", "name");

-- CreateIndex
CREATE INDEX "TemperatureLog_propertyId_loggedAt_idx" ON "TemperatureLog"("propertyId", "loggedAt");

-- CreateIndex
CREATE INDEX "TemperatureLog_unitId_loggedAt_idx" ON "TemperatureLog"("unitId", "loggedAt");

-- CreateIndex
CREATE INDEX "TemperatureLog_createdById_loggedAt_idx" ON "TemperatureLog"("createdById", "loggedAt");

-- AddForeignKey
ALTER TABLE "RefrigerationUnit" ADD CONSTRAINT "RefrigerationUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RefrigerationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
