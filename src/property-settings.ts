import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

export type PropertySettingsDTO = {
  fridgeMinTenthC: number;
  fridgeMaxTenthC: number;
  freezerMinTenthC: number;
  freezerMaxTenthC: number;
  refrigerationAmStart: string;
  refrigerationAmEnd: string;
  refrigerationPmStart: string;
  refrigerationPmEnd: string;
  foodCostTargetBps: number;
  cookedMinTenthC: number;
  reheatedMinTenthC: number;
  chilledMinTenthC: number;
  chilledMaxTenthC: number;
  blastChillTargetTenthC: number;
  blastChillMaxMinutes: number;
};

export function isFridgeTempInRange(
  valueTenthC: number,
  settings: PropertySettingsDTO
) {
  return (
    valueTenthC >= settings.fridgeMinTenthC &&
    valueTenthC <= settings.fridgeMaxTenthC
  );
}

export function isFreezerTempInRange(
  valueTenthC: number,
  settings: PropertySettingsDTO
) {
  return (
    valueTenthC >= settings.freezerMinTenthC &&
    valueTenthC <= settings.freezerMaxTenthC
  );
}

export async function getPropertySettings(
  propertyId: string
): Promise<PropertySettingsDTO> {
  const settings = await prisma.propertySettings.upsert({
    where: { propertyId },
    create: { propertyId },
    update: {},
    select: {
      fridgeMinTenthC: true,
      fridgeMaxTenthC: true,
      freezerMinTenthC: true,
      freezerMaxTenthC: true,
      refrigerationAmStart: true,
      refrigerationAmEnd: true,
      refrigerationPmStart: true,
      refrigerationPmEnd: true,
      foodCostTargetBps: true,
      cookedMinTenthC: true,
      reheatedMinTenthC: true,
      chilledMinTenthC: true,
      chilledMaxTenthC: true,
      blastChillTargetTenthC: true,
      blastChillMaxMinutes: true,
    },
  });

  return settings;
}

export async function getActivePropertySettings() {
  const session = await getSession();
  const propertyId = session?.user?.activePropertyId;
  if (!session?.user || !propertyId) return null;

  const settings = await getPropertySettings(propertyId);

  return { propertyId, settings };
}