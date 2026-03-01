import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function parseBatchId(notes: string | null) {
  if (!notes) return null;
  const m = notes.match(/\[BC:([^\]]+)\]/);
  return m ? m[1] : null;
}
type StartRow = {
  id: string;
  foodName: string;
  loggedAt: Date;
  tempC: any;
  notes: string | null;
  createdByUserId: string | null;
  createdByUser: { id: string; name: string | null; email: string } | null;
};

type EndRow = {
  notes: string | null;
};
type UserRow = { id: string; name: string | null; email: string };
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  // last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

 const starts: StartRow[] = await prisma.foodTemperatureLog.findMany({
  where: {
    propertyId,
    loggedAt: { gte: cutoff },
    notes: { contains: "[BLAST_CHILL_START]" },
  },
  orderBy: { loggedAt: "desc" },
  take: 2000,
  select: {
  id: true,
  foodName: true,
  loggedAt: true,
  tempC: true,
  notes: true,
  createdByUserId: true,
},
});

const ends: EndRow[] = await prisma.foodTemperatureLog.findMany({
  where: {
    propertyId,
    loggedAt: { gte: cutoff },
    notes: { contains: "[BLAST_CHILL_END]" },
  },
  orderBy: { loggedAt: "desc" },
  take: 2000,
  select: { notes: true },
});

  const endedBatchIds = new Set<string>();
  for (const e of ends) {
    const bid = parseBatchId(e.notes);
    if (bid) endedBatchIds.add(bid);
  }

const userIds = Array.from(
  new Set(starts.map((s) => s.createdByUserId).filter(Boolean))
) as string[];

const users: UserRow[] = userIds.length
  ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
  : [];

const userById = new Map(users.map((u) => [u.id, u]));

  const open = starts
    .map((s) => {
      const batchId = parseBatchId(s.notes);
      return {
        id: s.id,
        batchId,
        foodName: s.foodName,
        startAt: s.loggedAt.toISOString(),
        startTempC: s.tempC?.toString?.() ?? (s.tempC == null ? null : String(s.tempC)),
        notes: s.notes ?? null,
        createdBy: s.createdByUserId ? userById.get(s.createdByUserId) ?? null : null,
        createdByUserId: s.createdByUserId ?? null,
      };
    })
    .filter((s: { batchId: string | null }) => s.batchId && !endedBatchIds.has(s.batchId));

  return NextResponse.json({ open });
}