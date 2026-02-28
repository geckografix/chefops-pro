-- CreateTable
CREATE TABLE "ProcurementRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" "ProcurementCategory" NOT NULL DEFAULT 'FOOD',
    "status" "ProcurementStatus" NOT NULL DEFAULT 'REQUESTED',
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "neededBy" TIMESTAMP(3),
    "notes" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectedReason" "ProcurementRejectionReason",
    "rejectedNote" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcurementRequest_propertyId_category_status_createdAt_idx" ON "ProcurementRequest"("propertyId", "category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProcurementRequest_propertyId_status_neededBy_idx" ON "ProcurementRequest"("propertyId", "status", "neededBy");

-- CreateIndex
CREATE INDEX "ProcurementRequest_requestedById_createdAt_idx" ON "ProcurementRequest"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "ProcurementRequest_decidedById_decidedAt_idx" ON "ProcurementRequest"("decidedById", "decidedAt");

-- AddForeignKey
ALTER TABLE "ProcurementRequest" ADD CONSTRAINT "ProcurementRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementRequest" ADD CONSTRAINT "ProcurementRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementRequest" ADD CONSTRAINT "ProcurementRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
