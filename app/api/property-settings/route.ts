import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

async function requireAdmin() {
  const session = await getSession();

  if (!session?.user) {
    return { ok: false as const, res: NextResponse.json({ error: "Not logged in" }, { status: 401 }) };
  }

  const propertyId = session.user.activePropertyId;
  if (!propertyId) {
    return { ok: false as const, res: NextResponse.json({ error: "No active property" }, { status: 400 }) };
  }

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, propertyId };
}

function asInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const settings = await prisma.propertySettings.upsert({
    where: { propertyId: gate.propertyId },
    create: { propertyId: gate.propertyId },
    update: {},
  });

  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({} as any));

  const blastMax = asInt(body.blastChillMaxMinutes, 0);

  const data = {
    fridgeMinTenthC: asInt(body.fridgeMinTenthC, 10),
    fridgeMaxTenthC: asInt(body.fridgeMaxTenthC, 50),
    freezerMinTenthC: asInt(body.freezerMinTenthC, -250),
    freezerMaxTenthC: asInt(body.freezerMaxTenthC, -150),
    foodCostTargetBps: asInt(body.foodCostTargetBps, 3000),
    cookedMinTenthC: asInt(body.cookedMinTenthC, 750),
    reheatedMinTenthC: asInt(body.reheatedMinTenthC, 750),
    chilledMinTenthC: asInt(body.chilledMinTenthC, 0),
    chilledMaxTenthC: asInt(body.chilledMaxTenthC, 50),
    blastChillTargetTenthC: asInt(body.blastChillTargetTenthC, 50),
    blastChillMaxMinutes: blastMax > 0 ? blastMax : 90,
  };

  const settings = await prisma.propertySettings.upsert({
    where: { propertyId: gate.propertyId },
    create: { propertyId: gate.propertyId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true, settings });
}