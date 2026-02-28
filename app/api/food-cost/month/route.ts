import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function startOfMonthUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function addMonthsUTC(d: Date, months: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 0, 0, 0));
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;

  if (typeof v === "number") {
    return Number.isFinite(v) ? Math.trunc(v) : null;
  }

  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  return null;
}


export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const propertyId = session.user.activePropertyId;
  if (!propertyId) {
    return NextResponse.json({ error: "No active property" }, { status: 400 });
  }

  // Admin only
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  const monthStartISO = typeof body?.monthStartISO === "string" ? body.monthStartISO : null;
  if (!monthStartISO) {
    return NextResponse.json({ error: "monthStartISO is required" }, { status: 400 });
  }

  const parsed = new Date(monthStartISO);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid monthStartISO" }, { status: 400 });
  }

  // Normalize to first-of-month UTC to match your schema concept
  const monthStart = startOfMonthUTC(parsed);

  const foodPurchasesPence = toIntOrNull(body?.foodPurchasesPence);
  const foodSalesPence = toIntOrNull(body?.foodSalesPence);
  const creditsPence = toIntOrNull(body?.creditsPence);
  const openingStockPence = toIntOrNull(body?.openingStockPence);
  const closingStockPence = toIntOrNull(body?.closingStockPence);

  // IMPORTANT:
  // Build update object ONLY with fields provided (so partial patches work)
  const data: Record<string, number> = {};
  if (foodPurchasesPence !== null) data.foodPurchasesPence = foodPurchasesPence;
  if (foodSalesPence !== null) data.foodSalesPence = foodSalesPence;
  if (creditsPence !== null) data.creditsPence = creditsPence;
  if (openingStockPence !== null) data.openingStockPence = openingStockPence;
  if (closingStockPence !== null) data.closingStockPence = closingStockPence;

  // Save this month
  const saved = await prisma.monthlyFoodCost.upsert({
    where: { propertyId_monthStart: { propertyId, monthStart } },
    update: data,
    create: {
      propertyId,
      monthStart,
      foodPurchasesPence: data.foodPurchasesPence ?? 0,
      foodSalesPence: data.foodSalesPence ?? 0,
      creditsPence: data.creditsPence ?? 0,
      openingStockPence: data.openingStockPence ?? 0,
      closingStockPence: data.closingStockPence ?? 0,
    },
  });

  // Carry-forward closing -> next month opening (only if closing was provided)
  if (closingStockPence !== null) {
    const nextMonthStart = addMonthsUTC(monthStart, 1);

    // safeguard: only overwrite next month opening if it’s still 0
    const nextExisting = await prisma.monthlyFoodCost.findUnique({
      where: { propertyId_monthStart: { propertyId, monthStart: nextMonthStart } },
      select: { id: true, openingStockPence: true },
    });

    if (!nextExisting) {
      await prisma.monthlyFoodCost.create({
        data: {
          propertyId,
          monthStart: nextMonthStart,
          openingStockPence: closingStockPence,
          // rest default to 0
        },
      });
    } else if (nextExisting.openingStockPence === 0) {
      await prisma.monthlyFoodCost.update({
        where: { id: nextExisting.id },
        data: { openingStockPence: closingStockPence },
      });
    }
  }

  return NextResponse.json({ ok: true, record: saved });
}

