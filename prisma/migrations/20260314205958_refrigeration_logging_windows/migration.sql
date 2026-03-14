-- AlterTable
ALTER TABLE "PropertySettings" ADD COLUMN     "refrigerationAmEnd" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN     "refrigerationAmStart" TEXT NOT NULL DEFAULT '06:00',
ADD COLUMN     "refrigerationPmEnd" TEXT NOT NULL DEFAULT '21:00',
ADD COLUMN     "refrigerationPmStart" TEXT NOT NULL DEFAULT '17:00';
