import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "../../../src/lib/session";
import { prisma } from "../../../src/lib/prisma";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession(req, res as any, sessionOptions);

  if (!session.user?.activePropertyId || !session.user?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const propertyId = session.user.activePropertyId;
  const userId = session.user.userId;

  const body = await req.json().catch(() => null);

  const unitId = String(body?.unitId || "");
  const period = body?.period === "AM" ? "AM" : body?.period === "PM" ? "PM" : "OTHER";
  const status = body?.status === "DEFROST" ? "DEFROST" : "NORMAL";
  const notes = body?.notes ? String(body.notes).trim() : null;

  // valueC can be null for DEFROST
  const rawValue = body?.valueC;
  const valueC = rawValue === null || rawValue === undefined || rawValue === "" ? null : Number(rawValue);

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  if (status === "NORMAL") {
    if (valueC === null || Number.isNaN(valueC)) {
      return NextResponse.json({ error: "valueC is required for NORMAL logs" }, { status: 400 });
    }
  }

  // Safety: ensure the unit belongs to the active property
  const unit = await prisma.refrigerationUnit.findFirst({
    where: { id: unitId, propertyId, isActive: true },
    select: { id: true },
  });

  if (!unit) {
    return NextResponse.json({ error: "Invalid refrigeration unit" }, { status: 400 });
  }

  const log = await prisma.temperatureLog.create({
    data: {
      propertyId,
      unitId,
      period,
      status,
      valueC: status === "DEFROST" ? null : valueC,
      notes,
      createdById: userId,
    },
  });

  return NextResponse.json({ log });
}
