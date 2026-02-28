import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "../../../../src/lib/session";
import { prisma } from "../../../../src/lib/prisma";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
}

export async function GET(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession(req, res as any, sessionOptions);

  if (!session.user?.activePropertyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const propertyId = session.user.activePropertyId;
  const start = startOfToday();

  // Latest first, only AM/PM
  const logs = await prisma.temperatureLog.findMany({
    where: {
      propertyId,
      loggedAt: { gte: start },
      period: { in: ["AM", "PM"] },
    },
    orderBy: { loggedAt: "desc" },
    take: 1000,
    include: {
      createdBy: { select: { email: true } },
    },
  });

  // Latest per unit+period (unitId:AM, unitId:PM)
  const latest: Record<string, any> = {};

  for (const l of logs) {
    const key = `${l.unitId}:${l.period}`;
    if (latest[key]) continue;

    latest[key] = {
      unitId: l.unitId,
      period: l.period,
      status: l.status,
      valueC: l.valueC === null ? null : String(l.valueC),
      notes: l.notes ?? null,
      loggedAt: l.loggedAt.toISOString(),
      byEmail: l.createdBy.email,
    };
  }

  return NextResponse.json({ latest });
}

