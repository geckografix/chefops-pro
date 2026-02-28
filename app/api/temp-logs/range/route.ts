import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function utcDayStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function monthsAgoUtc(months: number, now = new Date()) {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

    const propertyId = session.user.activePropertyId;
    if (!propertyId) return NextResponse.redirect(new URL("/login", req.url));

    const membership = await prisma.propertyMembership.findFirst({
      where: { propertyId, userId: session.user.userId, isActive: true },
      select: { role: true },
    });
    if (!membership) return NextResponse.json({ error: "Not a member of this property." }, { status: 403 });

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    // Default: last 3 months to today
    const now = new Date();
    const defaultFrom = utcDayStart(monthsAgoUtc(3, now));
    const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)); // tomorrow 00:00Z

    const from = fromParam ? new Date(fromParam) : defaultFrom;
    const to = toParam ? new Date(toParam) : defaultTo;

    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
      return NextResponse.json({ error: "Invalid from/to range." }, { status: 400 });
    }

    // Guardrail: don’t allow printing older than last 3 months (retention policy)
    const minAllowed = defaultFrom;
    if (from < minAllowed) {
      return NextResponse.json(
        { error: "Range too old. Printing is limited to the last 3 months." },
        { status: 400 }
      );
    }

    const logs = await prisma.foodTemperatureLog.findMany({
      where: {
        propertyId,
        loggedAt: { gte: from, lt: to },
      },
      orderBy: [{ logDate: "asc" }, { period: "asc" }, { loggedAt: "asc" }],
      select: {
        id: true,
        loggedAt: true,
        logDate: true,
        period: true,
        status: true,
        foodName: true,
        tempC: true,
        notes: true,
      },
    });

    const safeLogs = logs.map((l: any) => ({
      ...l,
      tempC: l.tempC === null ? null : String(l.tempC),
    }));

    return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), logs: safeLogs });
  } catch (err: any) {
    console.error("TEMP-LOGS RANGE ERROR:", err);
    return NextResponse.json(
      { error: "Failed to load range.", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
