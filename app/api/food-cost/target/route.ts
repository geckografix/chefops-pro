import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const prop = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { targetFoodCostPct: true },
  });

  return NextResponse.json({ ok: true, targetFoodCostPct: prop?.targetFoodCostPct ?? null });
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
  const targetFoodCostPct = body?.targetFoodCostPct;

  if (targetFoodCostPct !== null && targetFoodCostPct !== undefined && !Number.isFinite(Number(targetFoodCostPct))) {
    return NextResponse.json({ error: "targetFoodCostPct must be a number or null" }, { status: 400 });
  }

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { targetFoodCostPct: targetFoodCostPct === null ? null : Number(targetFoodCostPct) },
    select: { targetFoodCostPct: true },
  });

  return NextResponse.json({ ok: true, targetFoodCostPct: updated.targetFoodCostPct });
}
