import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const propertyId = session.user.activePropertyId;
  if (!propertyId) {
    return NextResponse.json({ error: "No active property" }, { status: 400 });
  }

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const requestId = asString(body?.requestId);

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  const found = await prisma.maintenanceRequest.findFirst({
    where: { id: requestId, propertyId },
    select: {
      id: true,
      read: { select: { id: true } },
      completed: { select: { id: true } },
    },
  });

  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ensure "read" exists for audit trail when completing
  if (!found.read) {
    try {
      await prisma.maintenanceRead.create({
        data: { requestId, adminId: session.user.userId },
      });
    } catch {
      // ignore if race condition
    }
  }

  // idempotent (unique on requestId)
  try {
    await prisma.maintenanceCompletion.create({
      data: { requestId, adminId: session.user.userId },
    });
  } catch {
    // already completed
  }

  return NextResponse.json({ ok: true });
}