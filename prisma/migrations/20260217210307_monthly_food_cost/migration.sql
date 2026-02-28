-- CreateTable
CREATE TABLE "MonthlyFoodCost" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "monthStart" TIMESTAMP(3) NOT NULL,
    "foodPurchasesPence" INTEGER NOT NULL DEFAULT 0,
    "foodSalesPence" INTEGER NOT NULL DEFAULT 0,
    "creditsPence" INTEGER NOT NULL DEFAULT 0,
    "openingStockPence" INTEGER NOT NULL DEFAULT 0,
    "closingStockPence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyFoodCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyFoodCost_propertyId_monthStart_idx" ON "MonthlyFoodCost"("propertyId", "monthStart");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyFoodCost_propertyId_monthStart_key" ON "MonthlyFoodCost"("propertyId", "monthStart");

-- AddForeignKey
ALTER TABLE "MonthlyFoodCost" ADD CONSTRAINT "MonthlyFoodCost_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
