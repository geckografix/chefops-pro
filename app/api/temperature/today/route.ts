import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { getPropertySettings, isFridgeTempInRange, isFreezerTempInRange,} from "@/src/property-settings";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
}

function timeStringToMinutes(value: string) {
  const [hh, mm] = value.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function isWindowClosed(nowMins: number, endHHMM: string) {
  return nowMins > timeStringToMinutes(endHHMM);
}

export async function GET(req: Request) {
  const session = await getSession();

  if (!session?.user?.activePropertyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const propertyId = session.user.activePropertyId;
  const settings = await getPropertySettings(propertyId);
  const start = startOfToday();
  const nowMins = nowMinutes();
  const amClosed = isWindowClosed(nowMins, settings.refrigerationAmEnd);
  const pmClosed = isWindowClosed(nowMins, settings.refrigerationPmEnd);

  // Latest first, only AM/PM
  const units = await prisma.refrigerationUnit.findMany({
    where: { propertyId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

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
      unit: { select: { type: true } },
    },
  });

  // Latest per unit+period (unitId:AM, unitId:PM)
  const latest: Record<string, any> = {};

  for (const l of logs) {
    const key = `${l.unitId}:${l.period}`;
    if (latest[key]) continue;

    const valueTenthC =
      l.valueC === null ? null : Math.round(Number(l.valueC) * 10);

    const inRange =
      l.status === "DEFROST" || valueTenthC === null
        ? null
        : l.unit.type === "FREEZER"
        ? isFreezerTempInRange(valueTenthC, settings)
        : isFridgeTempInRange(valueTenthC, settings);

    latest[key] = {
      unitId: l.unitId,
      period: l.period,
      status: l.status,
      valueC: l.valueC === null ? null : String(l.valueC),
      notes: l.notes ?? null,
      loggedAt: l.loggedAt.toISOString(),
      byEmail: l.createdBy.email,
      unitType: l.unit.type,
      inRange,
    };
  }

  const unitStatus = units.map((unit: any) => {
    const amLog = latest[`${unit.id}:AM`] ?? null;
    const pmLog = latest[`${unit.id}:PM`] ?? null;

    return {
      unitId: unit.id,
      unitName: unit.name,
      unitType: unit.type,
      hasAmLog: !!amLog,
      hasPmLog: !!pmLog,
      missedAm: amClosed && !amLog,
      missedPm: pmClosed && !pmLog,
      amLog,
      pmLog,
    };
  });

  const hasAmLog = unitStatus.some((u: any) => u.hasAmLog);
  const hasPmLog = unitStatus.some((u: any) => u.hasPmLog);

  return NextResponse.json({
    latest,
    unitStatus,
    hasAmLog,
    hasPmLog,
    missedAm: amClosed && !hasAmLog,
    missedPm: pmClosed && !hasPmLog,
    refrigerationWindows: {
      amStart: settings.refrigerationAmStart,
      amEnd: settings.refrigerationAmEnd,
      pmStart: settings.refrigerationPmStart,
      pmEnd: settings.refrigerationPmEnd,
    },
  });
}

