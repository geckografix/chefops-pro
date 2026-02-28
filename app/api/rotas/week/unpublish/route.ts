import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function mondayOfWeekUTC(d: Date) {
  // Canonical weekStart: Monday 00:00:00.000 UTC
  const utcMidnight = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );
  const day = (utcMidnight.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - day);
  return utcMidnight;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const propertyId = session.user.activePropertyId;
  const userId = session.user.userId;

  if (!propertyId) {
    return NextResponse.json({ error: "No active property" }, { status: 400 });
  }

  // Admin-only
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const weekStartISO: string | undefined = body?.weekStartISO ?? body?.weekStart;

  if (!weekStartISO || typeof weekStartISO !== "string") {
    return NextResponse.json({ error: "weekStartISO is required" }, { status: 400 });
  }

  const parsed = new Date(weekStartISO);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid weekStartISO" }, { status: 400 });
  }

  const normalizedWeekStart = mondayOfWeekUTC(parsed);

  const week = await prisma.rotaWeek.upsert({
    where: { propertyId_weekStart: { propertyId, weekStart: normalizedWeekStart } },
    update: {
      isPublished: false,
      publishedAt: null,
      publishedById: null,
    },
    create: {
      propertyId,
      weekStart: normalizedWeekStart,
      isPublished: false,
      publishedAt: null,
      publishedById: null,
    },
    select: { id: true, isPublished: true, weekStart: true },
  });

  return NextResponse.json({ ok: true, week });
}

