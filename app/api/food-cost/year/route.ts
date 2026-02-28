import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function yearRangeUTC(year: number) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  return { start, end };
}

function intToNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  return Number(v) || 0;
}


export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
    }

    const propertyId = session.user.activePropertyId;
    if (!propertyId) {
      return NextResponse.json({ ok: false, error: "No active property" }, { status: 400 });
    }

    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : NaN;
    if (!Number.isFinite(year)) {
      return NextResponse.json({ ok: false, error: "Invalid year" }, { status: 400 });
    }

    // Admin check (same pattern as month route)
    const membership = await prisma.propertyMembership.findFirst({
      where: { propertyId, userId: session.user.userId, isActive: true },
      select: { role: true },
    });
    const isAdmin = membership?.role === "PROPERTY_ADMIN";

    const { start, end } = yearRangeUTC(year);

    const rows = await prisma.monthlyFoodCost.findMany({
      where: {
        propertyId,
        monthStart: { gte: start, lt: end },
      },
      orderBy: { monthStart: "asc" },
      select: {
        monthStart: true,
        foodPurchasesPence: true,
        foodSalesPence: true,
        creditsPence: true,
        openingStockPence: true,
        closingStockPence: true,
      },
    });

    // IMPORTANT: return monthStartISO for your UI merge key
    type Row = {
  monthStart: Date;
  foodPurchasesPence: number | bigint | null;
  foodSalesPence: number | bigint | null;
  creditsPence: number | bigint | null;
  openingStockPence: number | bigint | null;
  closingStockPence: number | bigint | null;
};

const records = (rows as Row[]).map((r) => ({
  monthStartISO: r.monthStart.toISOString(),
  foodPurchasesPence: intToNumber(r.foodPurchasesPence),
  foodSalesPence: intToNumber(r.foodSalesPence),
  creditsPence: intToNumber(r.creditsPence),
  openingStockPence: intToNumber(r.openingStockPence),
  closingStockPence: intToNumber(r.closingStockPence),
}));

    return NextResponse.json({ ok: true, year, isAdmin, records });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
