-- CreateTable
CREATE TABLE "TeamHandover" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "handoverDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamHandoverRead" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamHandoverRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamHandover_propertyId_handoverDate_idx" ON "TeamHandover"("propertyId", "handoverDate");

-- CreateIndex
CREATE INDEX "TeamHandover_propertyId_createdAt_idx" ON "TeamHandover"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamHandoverRead_readerId_readAt_idx" ON "TeamHandoverRead"("readerId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamHandoverRead_handoverId_readerId_key" ON "TeamHandoverRead"("handoverId", "readerId");

-- AddForeignKey
ALTER TABLE "TeamHandover" ADD CONSTRAINT "TeamHandover_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHandoverRead" ADD CONSTRAINT "TeamHandoverRead_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "TeamHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHandoverRead" ADD CONSTRAINT "TeamHandoverRead_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
