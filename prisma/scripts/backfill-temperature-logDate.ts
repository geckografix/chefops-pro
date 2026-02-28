import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Sets temperatureLog.logDate to the UTC day bucket (00:00:00Z)
 * for any rows where logDate is null/undefined (or missing due to older data).
 *
 * Assumes Postgres.
 */
async function main() {
  // Use raw SQL for speed and correctness on UTC day truncation.
  // This updates any rows where logDate is NULL.
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "temperatureLog"
    SET "logDate" = (date_trunc('day', "loggedAt" AT TIME ZONE 'utc') AT TIME ZONE 'utc')
    WHERE "logDate" IS NULL
  `);

  console.log(`Updated rows: ${result}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
