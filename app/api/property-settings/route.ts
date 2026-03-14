import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { getPropertySettings } from "@/src/property-settings";

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

  const settings = await getPropertySettings(gate.propertyId);

  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({} as any));

  const blastMax = asInt(body.blastChillMaxMinutes, 0);

  const current = await getPropertySettings(gate.propertyId);

  const data = {
    fridgeMinTenthC:
      body.fridgeMinTenthC === undefined
        ? current.fridgeMinTenthC
        : asInt(body.fridgeMinTenthC, current.fridgeMinTenthC),
    fridgeMaxTenthC:
      body.fridgeMaxTenthC === undefined
        ? current.fridgeMaxTenthC
        : asInt(body.fridgeMaxTenthC, current.fridgeMaxTenthC),
    freezerMinTenthC:
      body.freezerMinTenthC === undefined
        ? current.freezerMinTenthC
        : asInt(body.freezerMinTenthC, current.freezerMinTenthC),
    freezerMaxTenthC:
      body.freezerMaxTenthC === undefined
        ? current.freezerMaxTenthC
        : asInt(body.freezerMaxTenthC, current.freezerMaxTenthC),
    refrigerationAmStart:
      body.refrigerationAmStart === undefined
        ? current.refrigerationAmStart
        : String(body.refrigerationAmStart || current.refrigerationAmStart),
    refrigerationAmEnd:
      body.refrigerationAmEnd === undefined
        ? current.refrigerationAmEnd
        : String(body.refrigerationAmEnd || current.refrigerationAmEnd),
    refrigerationPmStart:
      body.refrigerationPmStart === undefined
        ? current.refrigerationPmStart
        : String(body.refrigerationPmStart || current.refrigerationPmStart),
    refrigerationPmEnd:
      body.refrigerationPmEnd === undefined
        ? current.refrigerationPmEnd
        : String(body.refrigerationPmEnd || current.refrigerationPmEnd),
    foodCostTargetBps:
      body.foodCostTargetBps === undefined
        ? current.foodCostTargetBps
        : asInt(body.foodCostTargetBps, current.foodCostTargetBps),
    cookedMinTenthC:
      body.cookedMinTenthC === undefined
        ? current.cookedMinTenthC
        : asInt(body.cookedMinTenthC, current.cookedMinTenthC),
    reheatedMinTenthC:
      body.reheatedMinTenthC === undefined
        ? current.reheatedMinTenthC
        : asInt(body.reheatedMinTenthC, current.reheatedMinTenthC),
    chilledMinTenthC:
      body.chilledMinTenthC === undefined
        ? current.chilledMinTenthC
        : asInt(body.chilledMinTenthC, current.chilledMinTenthC),
    chilledMaxTenthC:
      body.chilledMaxTenthC === undefined
        ? current.chilledMaxTenthC
        : asInt(body.chilledMaxTenthC, current.chilledMaxTenthC),
    blastChillTargetTenthC:
      body.blastChillTargetTenthC === undefined
        ? current.blastChillTargetTenthC
        : asInt(body.blastChillTargetTenthC, current.blastChillTargetTenthC),
    blastChillMaxMinutes:
      body.blastChillMaxMinutes === undefined
        ? current.blastChillMaxMinutes
        : blastMax > 0
        ? Math.min(blastMax, 90)
        : current.blastChillMaxMinutes,
  };

  const settings = await prisma.propertySettings.upsert({
    where: { propertyId: gate.propertyId },
    create: { propertyId: gate.propertyId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true, settings });
}