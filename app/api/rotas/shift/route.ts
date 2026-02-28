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

function isValidTime(t: string) {
  return /^\d{2}:\d{2}$/.test(t);
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
const { weekStart, dayIndex, startTime, endTime, role, notes, assigneeUserId } = body || {};

  if (typeof dayIndex !== "number" || dayIndex < 0 || dayIndex > 6) {
    return NextResponse.json({ error: "Invalid dayIndex (0=Mon..6=Sun)" }, { status: 400 });
  }
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return NextResponse.json({ error: "Time must be HH:MM (e.g. 09:00)" }, { status: 400 });
  }
  if (!role || typeof role !== "string") {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  if (!weekStart || typeof weekStart !== "string") {
  return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
}

const parsedWeekStart = new Date(weekStart);
if (Number.isNaN(parsedWeekStart.getTime())) {
  return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
}

// Normalize to Monday 00:00 to avoid timezone drift / wrong-week writes
const normalizedWeekStart = mondayOfWeek(parsedWeekStart);

// Ensure the week exists (blank slate auto-created if missing)
const week = await prisma.rotaWeek.upsert({
  where: { propertyId_weekStart: { propertyId, weekStart: normalizedWeekStart } },
  update: {},
  create: { propertyId, weekStart: normalizedWeekStart },
  select: { id: true },
});

  // Validate assignee (must belong to same property) if provided
  let finalAssignee: string | null = null;
  if (typeof assigneeUserId === "string" && assigneeUserId.trim()) {
    const m = await prisma.propertyMembership.findFirst({
      where: { propertyId, userId: assigneeUserId, isActive: true },
      select: { userId: true },
    });
    if (!m) return NextResponse.json({ error: "Assignee is not in this property" }, { status: 400 });
    finalAssignee = assigneeUserId;
  }

  const shift = await prisma.rotaShift.create({
    data: {
      propertyId,
      weekId: week.id,
      dayIndex,
      startTime,
      endTime,
      role,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      userId: finalAssignee,
    },
  });

  return NextResponse.json({ ok: true, shift });
}

