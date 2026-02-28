import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function cutoff14DaysUTC() {
  const today = startOfDayUTC(new Date());
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - 13); // keep today + previous 13 days = 14 days total
  return cutoff;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "No access to this property" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  // 14-day rotation (delete older than cutoff)
  const cutoff = cutoff14DaysUTC();
  await prisma.teamHandover.deleteMany({
    where: { propertyId, handoverDate: { lt: cutoff } },
  });

  // Normalise handoverDate to start-of-day UTC for clean grouping
  const handoverDate = startOfDayUTC(new Date());

  const created = await prisma.teamHandover.create({
    data: {
      propertyId,
      authorId: session.user.userId,
      message,
      handoverDate,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}