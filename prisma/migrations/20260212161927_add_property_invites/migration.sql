-- CreateTable
CREATE TABLE "PropertyInvite" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'PROPERTY_USER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyInvite_tokenHash_key" ON "PropertyInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "PropertyInvite_propertyId_idx" ON "PropertyInvite"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyInvite_email_idx" ON "PropertyInvite"("email");

-- AddForeignKey
ALTER TABLE "PropertyInvite" ADD CONSTRAINT "PropertyInvite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyInvite" ADD CONSTRAINT "PropertyInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
