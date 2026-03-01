import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

type Person = { id: string; name: string | null; email: string };

type EndRow = {
  id: string;
  foodName: string;
  loggedAt: Date;
  tempC: any;
  notes: string | null;
  status: string | null;
  createdByUserId: string | null;
};

type StartRow = {
  loggedAt: Date;
  tempC: any;
  notes: string | null;
  createdByUserId: string | null;
};

function utcDayStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function parseBatchId(notes: string | null) {
  if (!notes) return null;
  const m = notes.match(/\[BC:([^\]]+)\]/);
  return m ? m[1] : null;
}

function cleanBlastNotes(notes: string | null) {
  if (!notes) return null;
  return (
    notes
      .replace(/\[BLAST_CHILL_START\]\s*/g, "")
      .replace(/\[BLAST_CHILL_END\]\s*/g, "")
      .replace(/\[BC:[^\]]+\]\s*/g, "")
      .replace(/\(mins=\-?\d+\)\s*/g, "")
      .trim() || null
  );
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const today = utcDayStart(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // Pull END logs for today (completed)
  const ends: EndRow[] = await prisma.foodTemperatureLog.findMany({
    where: {
      propertyId,
      loggedAt: { gte: today, lt: tomorrow },
      notes: { contains: "[BLAST_CHILL_END]" },
    },
    orderBy: { loggedAt: "desc" },
    take: 2000,
    select: {
      id: true,
      foodName: true,
      loggedAt: true,
      tempC: true,
      notes: true,
      status: true,
      createdByUserId: true,
    },
  });

  const batchIds = Array.from(new Set(ends.map((e) => parseBatchId(e.notes)).filter(Boolean))) as string[];

  const starts: StartRow[] = batchIds.length
    ? await prisma.foodTemperatureLog.findMany({
        where: {
          propertyId,
          notes: { contains: "[BLAST_CHILL_START]" },
          OR: batchIds.map((bid) => ({ notes: { contains: `[BC:${bid}]` } })),
        },
        orderBy: { loggedAt: "desc" },
        take: 2000,
        select: { loggedAt: true, tempC: true, notes: true, createdByUserId: true },
      })
    : [];

  // Map start by batchId
  const startByBatch = new Map<
    string,
    { loggedAt: string; tempC: string | null; createdByUserId: string | null }
  >();

  for (const s of starts) {
    const bid = parseBatchId(s.notes);
    if (!bid) continue;
    if (!startByBatch.has(bid)) {
      startByBatch.set(bid, {
        loggedAt: s.loggedAt.toISOString(),
        tempC: s.tempC?.toString?.() ?? (s.tempC == null ? null : String(s.tempC)),
        createdByUserId: s.createdByUserId ?? null,
      });
    }
  }

  // Build user map for START + END accountability (name/email)
  const userIds = Array.from(
    new Set(
      [
        ...ends.map((e) => e.createdByUserId).filter(Boolean),
        ...starts.map((s) => s.createdByUserId).filter(Boolean),
      ] as string[]
    )
  );

  const users: Person[] = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const userById = new Map<string, Person>(users.map((u) => [u.id, u]));

  function displayUser(userId: string | null | undefined) {
    if (!userId) return null;
    const u = userById.get(userId);
    if (!u) return null;
    return u.name?.trim() ? u.name : u.email;
  }

  const todayBatches = ends
    .map((e) => {
      const bid = parseBatchId(e.notes);
      if (!bid) return null;

      const start = startByBatch.get(bid) ?? null;

      return {
        batchId: bid,
        foodName: e.foodName,
        notes: cleanBlastNotes(e.notes),
        startAt: start?.loggedAt ?? null,
        startTempC: start?.tempC ?? null,
        endAt: e.loggedAt.toISOString(),
        endTempC: e.tempC?.toString?.() ?? (e.tempC == null ? null : String(e.tempC)),
        status: e.status ?? null,
        startBy: displayUser(start?.createdByUserId ?? null),
        endBy: displayUser(e.createdByUserId),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ today: todayBatches });
}