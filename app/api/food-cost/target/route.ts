import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { getPropertySettings } from "@/src/property-settings";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const settings = await getPropertySettings(propertyId);

  return NextResponse.json({ ok: true, foodCostTargetBps: settings.foodCostTargetBps });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  const userId = session.user.userId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  // Admin-only
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId, isActive: true },
    select: { role: true },
  });
  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const foodCostTargetBps = body?.foodCostTargetBps;

  if (foodCostTargetBps !== null && foodCostTargetBps !== undefined && !Number.isFinite(Number(foodCostTargetBps))) {
    return NextResponse.json({ error: "foodCostTargetBps must be a number or null" }, { status: 400 });
  }

  const updated = await prisma.propertySettings.upsert({
    where: { propertyId },
    create: {
      propertyId,
      foodCostTargetBps: foodCostTargetBps === null ? 3000 : Number(foodCostTargetBps),
    },
    update: {
      foodCostTargetBps: foodCostTargetBps === null ? 3000 : Number(foodCostTargetBps),
    },
    select: { foodCostTargetBps: true },
  });

  return NextResponse.json({ ok: true, foodCostTargetBps: updated.foodCostTargetBps });

}
