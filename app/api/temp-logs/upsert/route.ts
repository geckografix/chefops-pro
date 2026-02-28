import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { Prisma } from "@prisma/client";

function utcDayStart(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

function parseLoggedAt(v: unknown) {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isOneOf<T extends string>(val: unknown, allowed: readonly T[]): val is T {
  return typeof val === "string" && (allowed as readonly string[]).includes(val);
}
function parseBlastBatchId(notes: string | null) {
  if (!notes) return null;
  const m = notes.match(/\[BC:([^\]]+)\]/);
  return m ? m[1] : null;
}
const ALLOWED_PERIODS = ["AM", "PM", "OTHER"] as const; // LogPeriod
const ALLOWED_FOOD_STATUS = ["OK", "OUT_OF_RANGE", "DISCARDED", "REHEATED", "COOLED"] as const; // FoodTempStatus

type CreateBody = {
  // NO id allowed (immutable logs)
  foodName: string;
  tempC?: number | string | null;
  notes?: string | null;
  period?: (typeof ALLOWED_PERIODS)[number] | null;
  status?: (typeof ALLOWED_FOOD_STATUS)[number] | null;
  loggedAt?: string | null; // ISO timestamp (optional)
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.redirect(new URL("/login", req.url));

  // Member check (read/write access)
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this property." }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Amendment: immutable — reject any attempt to edit/overwrite
  if (body?.id) {
    return NextResponse.json(
      { error: "Temp logs are immutable and cannot be edited." },
      { status: 400 }
    );
  }

  const typed = body as CreateBody;

  const foodName = (typed.foodName ?? "").trim();
  if (!foodName) {
    return NextResponse.json({ error: "foodName is required." }, { status: 400 });
  }

  // period/status are optional
  const period =
    typed.period == null ? null : isOneOf(typed.period, ALLOWED_PERIODS) ? typed.period : undefined;

  if (period === undefined) {
    return NextResponse.json(
      { error: `period must be one of: ${ALLOWED_PERIODS.join(", ")}` },
      { status: 400 }
    );
  }

  const status =
    typed.status == null ? "OK" : isOneOf(typed.status, ALLOWED_FOOD_STATUS) ? typed.status : undefined;

  if (status === undefined) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_FOOD_STATUS.join(", ")}` },
      { status: 400 }
    );
  }

  // tempC optional; store as Decimal if provided
  let tempC: Prisma.Decimal | null = null;
  if (typed.tempC !== undefined && typed.tempC !== null && typed.tempC !== "") {
    const asNumber = typeof typed.tempC === "string" ? Number(typed.tempC) : typed.tempC;
    if (!Number.isFinite(asNumber)) {
      return NextResponse.json({ error: "tempC must be a valid number." }, { status: 400 });
    }
    tempC = new Prisma.Decimal(asNumber);
  }

 let notes = typed.notes == null ? null : String(typed.notes).trim() || null;

// Use provided loggedAt if valid, otherwise now
const now = parseLoggedAt(typed.loggedAt) ?? new Date();
const logDate = utcDayStart(now);

// Blast-chill tags
const isBlastStart = !!notes && notes.includes("[BLAST_CHILL_START]");
const isBlastEnd = !!notes && notes.includes("[BLAST_CHILL_END]");

if (isBlastStart && !tempC) {
  return NextResponse.json(
    { error: "Start temp is required for blast chill START." },
    { status: 400 }
  );
}

if (isBlastEnd && !tempC) {
  return NextResponse.json(
    { error: "Finish temp is required for blast chill END." },
    { status: 400 }
  );
}

// If END: enforce pairing + time/temp limits from Settings
let finalStatus: (typeof ALLOWED_FOOD_STATUS)[number] = status;

if (isBlastEnd) {
  // End temp is required
  if (!tempC) {
    return NextResponse.json(
      { error: "Finish temp is required for blast chill END." },
      { status: 400 }
    );
  }

  const batchId = parseBlastBatchId(notes);

const start = await prisma.foodTemperatureLog.findFirst({
  where: batchId
    ? {
        propertyId,
        notes: { contains: `[BLAST_CHILL_START][BC:${batchId}]` },
      }
    : {
        propertyId,
        foodName,
        notes: { contains: "[BLAST_CHILL_START]" },
      },
  orderBy: { loggedAt: "desc" },
  select: { loggedAt: true },
});

  if (!start) {
    return NextResponse.json(
      { error: "No blast chill START found for this food name." },
      { status: 400 }
    );
  }

  const mins = Math.round((now.getTime() - start.loggedAt.getTime()) / 60000);

  const ps = await prisma.propertySettings.findUnique({
    where: { propertyId },
    select: { blastChillTargetTenthC: true, blastChillMaxMinutes: true },
  });

  const targetTenth = ps?.blastChillTargetTenthC ?? 50; // default 5.0°C
  const maxMinutes = ps?.blastChillMaxMinutes ?? 90;

  const endC = Number(tempC.toString());
  const endTenth = Math.round(endC * 10);

  const tempOk = endTenth <= targetTenth;
  const timeOk = mins >= 0 && mins <= maxMinutes;

  finalStatus = tempOk && timeOk ? "OK" : "OUT_OF_RANGE";

  // Append minutes for audit trail (minimal, non-destructive)
  notes = `${notes ?? ""} (mins=${mins})`.trim();
}

// START doesn’t need extra validation; start temp optional
if (isBlastStart) {
  // no-op for now
}

  // Amendment: create-only (no updates, no overwrites)
  const created = await prisma.foodTemperatureLog.create({
    data: {
      propertyId,
      loggedAt: now,
      logDate,
      foodName,
      tempC,
      notes,
      period: period ?? null,
      status: finalStatus,
      createdByUserId: session.user.userId,
    },
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

  return NextResponse.json({ mode: "created", log: created });
}
