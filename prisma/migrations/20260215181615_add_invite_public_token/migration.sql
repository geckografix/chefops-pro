/*
  Warnings:

  - A unique constraint covering the columns `[publicToken]` on the table `PropertyInvite` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PropertyInvite" ADD COLUMN     "publicToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PropertyInvite_publicToken_key" ON "PropertyInvite"("publicToken");
