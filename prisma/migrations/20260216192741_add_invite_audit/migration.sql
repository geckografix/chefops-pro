-- CreateEnum
CREATE TYPE "InviteAuditAction" AS ENUM ('CREATED', 'REVOKED', 'ACCEPTED');

-- CreateTable
CREATE TABLE "InviteAudit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "action" "InviteAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InviteAudit_propertyId_createdAt_idx" ON "InviteAudit"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "InviteAudit_inviteId_createdAt_idx" ON "InviteAudit"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "InviteAudit_actorUserId_createdAt_idx" ON "InviteAudit"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "InviteAudit" ADD CONSTRAINT "InviteAudit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteAudit" ADD CONSTRAINT "InviteAudit_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "PropertyInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteAudit" ADD CONSTRAINT "InviteAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
