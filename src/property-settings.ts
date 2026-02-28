import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

export async function getActivePropertySettings() {
  const session = await getSession();
  const propertyId = session?.user?.activePropertyId;

  if (!session?.user || !propertyId) return null;

  // Ensure a row always exists (safe defaults from Prisma schema)
  const settings = await prisma.propertySettings.upsert({
    where: { propertyId },
    create: { propertyId },
    update: {},
  });

  return { propertyId, settings };
}