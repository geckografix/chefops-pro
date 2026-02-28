-- CreateEnum
CREATE TYPE "TemperatureStatus" AS ENUM ('NORMAL', 'DEFROST');

-- AlterTable
ALTER TABLE "TemperatureLog" ADD COLUMN     "status" "TemperatureStatus" NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "valueC" DROP NOT NULL;
