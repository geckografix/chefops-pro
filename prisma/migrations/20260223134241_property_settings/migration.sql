-- CreateTable
CREATE TABLE "PropertySettings" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fridgeMinTenthC" INTEGER NOT NULL DEFAULT 10,
    "fridgeMaxTenthC" INTEGER NOT NULL DEFAULT 50,
    "freezerMinTenthC" INTEGER NOT NULL DEFAULT -250,
    "freezerMaxTenthC" INTEGER NOT NULL DEFAULT -150,
    "foodCostTargetBps" INTEGER NOT NULL DEFAULT 3000,
    "cookedMinTenthC" INTEGER NOT NULL DEFAULT 750,
    "cookedMaxTenthC" INTEGER NOT NULL DEFAULT 950,
    "reheatedMinTenthC" INTEGER NOT NULL DEFAULT 750,
    "reheatedMaxTenthC" INTEGER NOT NULL DEFAULT 950,
    "chilledMinTenthC" INTEGER NOT NULL DEFAULT 0,
    "chilledMaxTenthC" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertySettings_propertyId_key" ON "PropertySettings"("propertyId");

-- CreateIndex
CREATE INDEX "PropertySettings_propertyId_idx" ON "PropertySettings"("propertyId");

-- AddForeignKey
ALTER TABLE "PropertySettings" ADD CONSTRAINT "PropertySettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
