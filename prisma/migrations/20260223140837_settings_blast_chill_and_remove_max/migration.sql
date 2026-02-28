/*
  Warnings:

  - You are about to drop the column `cookedMaxTenthC` on the `PropertySettings` table. All the data in the column will be lost.
  - You are about to drop the column `reheatedMaxTenthC` on the `PropertySettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PropertySettings" DROP COLUMN "cookedMaxTenthC",
DROP COLUMN "reheatedMaxTenthC",
ADD COLUMN     "blastChillMaxMinutes" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "blastChillTargetTenthC" INTEGER NOT NULL DEFAULT 50;
