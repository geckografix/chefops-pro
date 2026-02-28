import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
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

  const params = await Promise.resolve(ctx.params);
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: "Missing shift id" }, { status: 400 });
  }

  const shift = await prisma.rotaShift.findFirst({
    where: { id, propertyId },
    select: { id: true },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  await prisma.rotaShift.delete({ where: { id: shift.id } });

  return NextResponse.json({ ok: true });
}

function isValidTime(t: string) {
  return /^\d{2}:\d{2}$/.test(t);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
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

  const params = await Promise.resolve(ctx.params);
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: "Missing shift id" }, { status: 400 });
  }

  const shift = await prisma.rotaShift.findFirst({
    where: { id, propertyId },
    select: { id: true },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const { startTime, endTime, role, notes, assigneeUserId } = body || {};

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return NextResponse.json({ error: "Time must be HH:MM (e.g. 09:00)" }, { status: 400 });
  }

  if (!role || typeof role !== "string") {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

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

  const updated = await prisma.rotaShift.update({
    where: { id: shift.id },
    data: {
      startTime,
      endTime,
      role,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      userId: finalAssignee,
    },
  });

  return NextResponse.json({ ok: true, shift: updated });
}