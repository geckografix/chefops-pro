import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

type Person = { id: string; name: string | null; email: string };
type FoodLogRow = {
  id: string;
  loggedAt: Date;
  logDate: Date;
  period: string | null;
  status: string | null;
  foodName: string;
  tempC: any;
  notes: string | null;
  createdByUserId: string | null;
};
function utcDayStart(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

    const propertyId = session.user.activePropertyId;
    if (!propertyId) return NextResponse.redirect(new URL("/login", req.url));

    // Membership check
    const membership = await prisma.propertyMembership.findFirst({
      where: { propertyId, userId: session.user.userId, isActive: true },
      select: { role: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this property." }, { status: 403 });
    }

    const logDate = utcDayStart(new Date());

    // Immutable general food temp logs (no event filtering here)
    const logs: FoodLogRow[] = await prisma.foodTemperatureLog.findMany({
      where: { propertyId, logDate },
      orderBy: { loggedAt: "desc" },
      select: {
        id: true,
        loggedAt: true,
        logDate: true,
        period: true,
        status: true,
        foodName: true,
        tempC: true,
        notes: true,
        createdByUserId: true,
      },
    });

    // Resolve "logged by" user details (User model uses id)
    const userIds = Array.from(new Set(logs.map((l) => l.createdByUserId).filter(Boolean))) as string[];

    const users: Person[] = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const userMap = new Map<string, Person>(users.map((u) => [u.id, u]));

    // Ensure Decimal fields serialize safely + add loggedBy label
    const safeLogs = logs.map((l: any) => {
      const u = l.createdByUserId ? userMap.get(l.createdByUserId) ?? null : null;
      const loggedBy = u ? (u.name?.trim() ? u.name : u.email) : "Unknown user";

      return {
        ...l,
        loggedAt: l.loggedAt?.toISOString?.() ?? String(l.loggedAt),
        logDate: l.logDate?.toISOString?.() ?? String(l.logDate),
        tempC: l.tempC == null ? null : String(l.tempC),
        loggedBy,
      };
    });

    // Compliance (minimum 5 AM + 5 PM)
    const amCount = safeLogs.filter((l: any) => l.period === "AM").length;
    const pmCount = safeLogs.filter((l: any) => l.period === "PM").length;

    const amMin = 5;
    const pmMin = 5;

    const compliance = {
      amCount,
      pmCount,
      amMin,
      pmMin,
      amMissing: Math.max(0, amMin - amCount),
      pmMissing: Math.max(0, pmMin - pmCount),
      amOk: amCount >= amMin,
      pmOk: pmCount >= pmMin,
    };

    return NextResponse.json({
      logDate: logDate.toISOString(),
      logs: safeLogs,
      compliance,
    });
  } catch (err: any) {
    console.error("TEMP-LOGS TODAY ROUTE ERROR:", err);
    return NextResponse.json(
      {
        error: "Failed to load food temp logs.",
        detail: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
