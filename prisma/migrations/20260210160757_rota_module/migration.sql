-- CreateEnum
CREATE TYPE "ShiftRole" AS ENUM ('CHEF', 'SOUS_CHEF', 'CDP', 'COMMIS', 'KP', 'OTHER');

-- CreateTable
CREATE TABLE "RotaWeek" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaShift" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "userId" TEXT,
    "dayIndex" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "role" "ShiftRole" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RotaWeek_propertyId_weekStart_idx" ON "RotaWeek"("propertyId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "RotaWeek_propertyId_weekStart_key" ON "RotaWeek"("propertyId", "weekStart");

-- CreateIndex
CREATE INDEX "RotaShift_propertyId_weekId_idx" ON "RotaShift"("propertyId", "weekId");

-- CreateIndex
CREATE INDEX "RotaShift_propertyId_dayIndex_idx" ON "RotaShift"("propertyId", "dayIndex");

-- CreateIndex
CREATE INDEX "RotaShift_userId_idx" ON "RotaShift"("userId");

-- AddForeignKey
ALTER TABLE "RotaWeek" ADD CONSTRAINT "RotaWeek_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "RotaWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
