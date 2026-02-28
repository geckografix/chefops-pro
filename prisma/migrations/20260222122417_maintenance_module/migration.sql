-- CreateEnum
CREATE TYPE "MaintenanceUrgency" AS ENUM ('H24', 'H48', 'WEEK');

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "location" TEXT,
    "equipment" TEXT,
    "urgency" "MaintenanceUrgency" NOT NULL DEFAULT 'WEEK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRead" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_createdAt_idx" ON "MaintenanceRequest"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_urgency_idx" ON "MaintenanceRequest"("propertyId", "urgency");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRead_requestId_key" ON "MaintenanceRead"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceRead_adminId_readAt_idx" ON "MaintenanceRead"("adminId", "readAt");

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRead" ADD CONSTRAINT "MaintenanceRead_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRead" ADD CONSTRAINT "MaintenanceRead_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
