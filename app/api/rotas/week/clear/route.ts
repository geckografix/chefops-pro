import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function mondayOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  const userId = session.user.userId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  // Admin-only
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { weekStart } = body || {};

  if (!weekStart || typeof weekStart !== "string") {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  const parsed = new Date(weekStart);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }

  const normalizedWeekStart = mondayOfWeek(parsed);

  // Ensure week exists, then clear ALL shifts for that week+property
  const week = await prisma.rotaWeek.upsert({
    where: { propertyId_weekStart: { propertyId, weekStart: normalizedWeekStart } },
    update: {},
    create: { propertyId, weekStart: normalizedWeekStart },
    select: { id: true },
  });

  await prisma.rotaShift.deleteMany({
    where: { propertyId, weekId: week.id },
  });

  return NextResponse.json({ ok: true });
}
